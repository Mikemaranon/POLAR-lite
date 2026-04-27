import json

from flask import Response, request, stream_with_context

from api_m.domains.base_api import BaseAPI
from model_m import ProviderError


class ChatAPI(BaseAPI):
    def register(self):
        self.app.add_url_rule("/api/chat", view_func=self.chat, methods=["POST"])

    def chat(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = self.get_request_json(request)
        try:
            self.require_fields(data, "messages")
        except ValueError as error:
            return self.error(str(error), 400)

        if not isinstance(data.get("messages"), list):
            return self.error("messages must be a list", 400)

        try:
            conversation_id = self.parse_int(data.get("conversation_id"), "conversation_id")
        except ValueError as error:
            return self.error(str(error), 400)

        conversation = None
        if conversation_id is not None:
            conversation = self.db.conversations.get(conversation_id)
            if not conversation:
                return self.error("Conversation not found", 404)

        try:
            profile = self._resolve_profile(data, conversation)
        except ValueError as error:
            return self.error(str(error), 400)

        provider = data.get("provider") or (conversation["provider"] if conversation else None)
        model = data.get("model") or (conversation["model"] if conversation else None)

        if not provider:
            provider = self.model_manager.config_manager.providers.default_provider
        if not model:
            return self.error("Missing model", 400)

        input_messages = self._build_input_messages(profile, data["messages"])
        generation_settings = self._build_generation_settings(profile, data.get("settings"))
        stream_requested = self._is_stream_requested(data.get("stream"))

        if conversation:
            self._ensure_generated_conversation_title(
                conversation,
                provider,
                model,
                data["messages"],
            )
            self._persist_request_messages(conversation_id, data["messages"])
            self.db.conversations.touch(conversation_id)

        if stream_requested:
            return self._stream_chat_response(
                conversation_id,
                provider,
                input_messages,
                model,
                generation_settings,
            )

        try:
            response = self.model_manager.chat(
                provider,
                input_messages,
                model,
                generation_settings,
            )
        except ProviderError as error:
            return self.ok({"error": error.to_dict()}, error.status_code)

        if conversation:
            self._persist_assistant_message(conversation_id, response)
            self.db.conversations.touch(conversation_id)

        payload = {"response": response}
        if conversation:
            payload["conversation"] = self.db.conversations.get(conversation_id)

        return self.ok(payload)

    def _stream_chat_response(
        self,
        conversation_id,
        provider,
        input_messages,
        model,
        generation_settings,
    ):
        @stream_with_context
        def generate():
            try:
                yield self._format_sse(
                    "start",
                    {
                        "conversation_id": conversation_id,
                        "provider": provider,
                        "model": model,
                    },
                )

                final_response = None
                streamed_text_parts = []

                for event in self.model_manager.stream_chat(
                    provider,
                    input_messages,
                    model,
                    generation_settings,
                ):
                    event_type = event.get("type")

                    if event_type == "delta":
                        delta = event.get("delta") or ""
                        if delta:
                            streamed_text_parts.append(delta)
                            yield self._format_sse("delta", {"delta": delta})
                        continue

                    if event_type == "response":
                        final_response = event.get("response")

                if not final_response:
                    final_response = {
                        "provider": provider,
                        "model": model,
                        "message": {
                            "role": "assistant",
                            "content": "".join(streamed_text_parts),
                        },
                        "usage": {},
                        "finish_reason": None,
                        "message_id": None,
                        "raw": {
                            "streamed": True,
                            "reconstructed": True,
                        },
                    }

                if conversation_id:
                    self._persist_assistant_message(conversation_id, final_response)
                    self.db.conversations.touch(conversation_id)

                payload = {"response": final_response}
                if conversation_id:
                    payload["conversation"] = self.db.conversations.get(conversation_id)

                yield self._format_sse("end", payload)
            except ProviderError as error:
                yield self._format_sse("error", {"error": error.to_dict()})

        return Response(
            generate(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    def _resolve_profile(self, data, conversation):
        profile_id = data.get("profile_id")
        if profile_id is not None:
            parsed_profile_id = self.parse_int(profile_id, "profile_id")
            return self.db.profiles.get(parsed_profile_id)

        if conversation and conversation.get("profile_id"):
            return self.db.profiles.get(conversation["profile_id"])

        return self.get_default_profile()

    def _build_input_messages(self, profile, messages):
        normalized_messages = []

        if profile and profile.get("system_prompt"):
            normalized_messages.append(
                {
                    "role": "system",
                    "content": profile["system_prompt"],
                }
            )

        normalized_messages.extend(messages)
        return normalized_messages

    def _build_generation_settings(self, profile, override_settings):
        settings = {}

        if profile:
            settings["temperature"] = profile.get("temperature")
            settings["top_p"] = profile.get("top_p")
            settings["max_tokens"] = profile.get("max_tokens")

        if override_settings:
            settings.update(override_settings)

        return settings

    def _ensure_generated_conversation_title(
        self,
        conversation,
        provider,
        model,
        request_messages,
    ):
        stored_messages = self.db.messages.for_conversation(conversation["id"])
        if stored_messages:
            return

        first_user_message = self._get_first_user_message_content(request_messages)
        if not first_user_message:
            return

        try:
            generated_title = self.model_manager.generate_conversation_title(
                provider,
                model,
                first_user_message,
            )
        except Exception:
            return

        if not generated_title:
            return

        self.db.conversations.rename(conversation["id"], generated_title)

    def _get_first_user_message_content(self, messages):
        for message in messages:
            if message.get("role") != "user":
                continue

            content = message.get("content")
            if isinstance(content, str):
                normalized = " ".join(content.split())
                if normalized:
                    return normalized
                continue

            if isinstance(content, list):
                parts = []
                for item in content:
                    if isinstance(item, str) and item.strip():
                        parts.append(item.strip())
                        continue

                    if isinstance(item, dict):
                        text = str(item.get("text", "")).strip()
                        if text:
                            parts.append(text)

                normalized = " ".join(parts)
                if normalized:
                    return normalized

        return ""

    def _persist_request_messages(self, conversation_id, request_messages):
        stored_messages = self.db.messages.for_conversation(conversation_id)
        next_position = len(stored_messages)

        for offset, message in enumerate(request_messages[next_position:]):
            self.db.messages.create(
                conversation_id=conversation_id,
                role=message.get("role"),
                content=message.get("content", ""),
                position=next_position + offset,
            )

    def _persist_assistant_message(self, conversation_id, response):
        assistant_message = response.get("message", {})
        self.db.messages.create(
            conversation_id=conversation_id,
            role=assistant_message.get("role", "assistant"),
            content=assistant_message.get("content", ""),
            provider_message_id=response.get("message_id"),
        )

    def _is_stream_requested(self, raw_value):
        if isinstance(raw_value, str):
            return raw_value.strip().lower() in {"1", "true", "yes", "on"}

        return bool(raw_value)

    def _format_sse(self, event_name, payload):
        serialized = json.dumps(payload, ensure_ascii=False)
        return f"event: {event_name}\ndata: {serialized}\n\n"
