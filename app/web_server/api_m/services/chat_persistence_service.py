class ChatPersistenceService:
    def __init__(self, db_manager, model_manager):
        self.db = db_manager
        self.model_manager = model_manager

    def prepare_conversation(self, conversation, provider, model, request_messages):
        conversation_id = conversation["id"]
        self._ensure_generated_conversation_title(
            conversation,
            provider,
            model,
            request_messages,
        )
        self.persist_request_messages(conversation_id, request_messages)
        self.db.conversations.touch(conversation_id)

    def finalize_response(self, conversation_id, response):
        assistant_content = ((response.get("message") or {}).get("content") or "").strip()
        if not assistant_content:
            return

        self.persist_assistant_message(conversation_id, response)
        self.db.conversations.touch(conversation_id)

    def persist_request_messages(self, conversation_id, request_messages):
        stored_messages = self.db.messages.for_conversation(conversation_id)
        next_position = len(stored_messages)

        for offset, message in enumerate(request_messages[next_position:]):
            self.db.messages.create(
                conversation_id=conversation_id,
                role=message.get("role"),
                content=message.get("content", ""),
                position=next_position + offset,
            )

    def persist_assistant_message(self, conversation_id, response):
        assistant_message = response.get("message", {})
        self.db.messages.create(
            conversation_id=conversation_id,
            role=assistant_message.get("role", "assistant"),
            content=assistant_message.get("content", ""),
            provider_message_id=response.get("message_id"),
        )

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
