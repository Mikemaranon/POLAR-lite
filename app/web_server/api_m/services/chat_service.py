from dataclasses import dataclass

from model_m import ProviderError


class ChatRequestError(ValueError):
    pass


class ChatResourceNotFoundError(LookupError):
    pass


@dataclass
class PreparedChatRequest:
    conversation_id: int | None
    conversation: dict | None
    model_config_id: int | None
    provider: str
    model: str
    input_messages: list[dict]
    generation_settings: dict
    request_messages: list[dict]
    request_id: str
    stream_requested: bool


class ChatService:
    def __init__(
        self,
        db_manager,
        model_manager,
        context_builder,
        persistence_service,
        stream_service,
    ):
        self.db = db_manager
        self.model_manager = model_manager
        self.context_builder = context_builder
        self.persistence_service = persistence_service
        self.stream_service = stream_service

    def handle_request(self, data, parse_int, default_profile, default_provider):
        prepared = self._prepare_request(
            data,
            parse_int=parse_int,
            default_profile=default_profile,
            default_provider=default_provider,
        )

        if prepared.conversation:
            self.persistence_service.prepare_conversation(
                prepared.conversation,
                prepared.provider,
                prepared.model,
                prepared.request_messages,
            )

        if prepared.stream_requested:
            return self.stream_service.build_stream_response(
                prepared.conversation_id,
                prepared.provider,
                prepared.input_messages,
                prepared.model,
                prepared.generation_settings,
                prepared.request_id,
            )

        response = self._run_chat(prepared)
        payload = {"response": response}
        if prepared.conversation_id:
            payload["conversation"] = self.db.conversations.get(prepared.conversation_id)
        return payload

    def _prepare_request(self, data, parse_int, default_profile, default_provider):
        self._validate_messages(data)
        conversation_id = self._parse_conversation_id(data, parse_int)
        conversation = self._get_conversation(conversation_id)
        project = self.context_builder.resolve_project(
            self._parse_optional_int(data.get("project_id"), "project_id", parse_int),
            conversation,
        )
        profile = self.context_builder.resolve_profile(
            self._parse_optional_int(data.get("profile_id"), "profile_id", parse_int),
            conversation,
            default_profile,
        )
        model_config_id = self._parse_optional_int(
            data.get("model_config_id", conversation["model_config_id"] if conversation else None),
            "model_config_id",
            parse_int,
        )
        model_config = self.db.models.get(model_config_id) if model_config_id else None

        provider = data.get("provider") or (conversation["provider"] if conversation else None)
        model = data.get("model") or (conversation["model"] if conversation else None)

        if model_config:
            provider = provider or model_config["provider"]
            model = model or model_config["name"]

        if not provider:
            provider = default_provider
        if not model:
            raise ChatRequestError("Missing model")

        generation_settings = self.context_builder.build_generation_settings(
            profile,
            data.get("settings"),
        )
        if model_config_id:
            generation_settings["_model_config_id"] = model_config_id

        return PreparedChatRequest(
            conversation_id=conversation_id,
            conversation=conversation,
            model_config_id=model_config_id,
            provider=provider,
            model=model,
            input_messages=self.context_builder.build_input_messages(
                project,
                profile,
                data["messages"],
            ),
            generation_settings=generation_settings,
            request_messages=data["messages"],
            request_id=self.stream_service.resolve_request_id(data.get("request_id")),
            stream_requested=self._is_stream_requested(data.get("stream")),
        )

    def _run_chat(self, prepared):
        try:
            response = self.model_manager.chat(
                prepared.provider,
                prepared.input_messages,
                prepared.model,
                prepared.generation_settings,
            )
        except ProviderError:
            raise

        if prepared.conversation_id:
            self.persistence_service.finalize_response(
                prepared.conversation_id,
                response,
            )

        return response

    def _validate_messages(self, data):
        if "messages" not in data:
            raise ChatRequestError("Missing messages")

        if not isinstance(data.get("messages"), list):
            raise ChatRequestError("messages must be a list")

    def _parse_conversation_id(self, data, parse_int):
        return self._parse_optional_int(
            data.get("conversation_id"),
            "conversation_id",
            parse_int,
        )

    def _parse_optional_int(self, raw_value, field_name, parse_int):
        return parse_int(raw_value, field_name)

    def _get_conversation(self, conversation_id):
        if conversation_id is None:
            return None

        conversation = self.db.conversations.get(conversation_id)
        if not conversation:
            raise ChatResourceNotFoundError("Conversation not found")
        return conversation

    def _is_stream_requested(self, raw_value):
        if isinstance(raw_value, str):
            return raw_value.strip().lower() in {"1", "true", "yes", "on"}

        return bool(raw_value)
