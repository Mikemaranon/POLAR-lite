from flask import request

from api_m.domains.base_api import BaseAPI


class ConversationsAPI(BaseAPI):
    def register(self):
        self.app.add_url_rule(
            "/api/conversations",
            view_func=self.handle_conversations_get,
            methods=["GET"],
        )
        self.app.add_url_rule(
            "/api/conversations",
            view_func=self.handle_conversations_post,
            methods=["POST"],
        )
        self.app.add_url_rule(
            "/api/conversations",
            view_func=self.handle_conversations_patch,
            methods=["PATCH"],
        )
        self.app.add_url_rule(
            "/api/conversations",
            view_func=self.handle_conversations_delete,
            methods=["DELETE"],
        )

    def handle_conversations_get(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        conversation_id = request.args.get("id")
        if conversation_id:
            try:
                parsed_id = self.parse_int(conversation_id, "id")
            except ValueError as error:
                return self.error(str(error), 400)

            conversation = self.db.conversations.get(parsed_id)
            if not conversation:
                return self.error("Conversation not found", 404)

            include_messages = request.args.get("include_messages", "0") in {"1", "true", "yes"}
            payload = {"conversation": conversation}
            if include_messages:
                payload["messages"] = self.db.messages.for_conversation(parsed_id)
            return self.ok(payload)

        project_id = request.args.get("project_id")
        try:
            parsed_project_id = self.parse_int(project_id, "project_id")
        except ValueError as error:
            return self.error(str(error), 400)

        conversations = self.db.conversations.all(parsed_project_id)
        return self.ok({"conversations": conversations})

    def handle_conversations_post(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = self.get_request_json(request)

        default_profile = self.get_default_profile()
        default_provider = self.config_manager.providers.default_provider

        try:
            project_id = self.parse_int(data.get("project_id"), "project_id")
            profile_id = self.parse_int(
                data.get("profile_id", default_profile["id"] if default_profile else None),
                "profile_id",
            )
        except ValueError as error:
            return self.error(str(error), 400)

        provider = data.get("provider", default_provider)
        model = data.get("model", "")
        title = data.get("title", "New Chat")

        conversation_id = self.db.conversations.create(
            title=title,
            project_id=project_id,
            profile_id=profile_id,
            provider=provider,
            model=model,
        )
        return self.ok({"conversation": self.db.conversations.get(conversation_id)}, 201)

    def handle_conversations_patch(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = self.get_request_json(request)

        try:
            conversation_id = self.parse_int(data.get("id"), "id")
            self.require_fields({"id": conversation_id}, "id")
        except ValueError as error:
            return self.error(str(error), 400)

        conversation = self.db.conversations.get(conversation_id)
        if not conversation:
            return self.error("Conversation not found", 404)

        try:
            project_id = self.parse_int(data.get("project_id", conversation["project_id"]), "project_id")
            profile_id = self.parse_int(data.get("profile_id", conversation["profile_id"]), "profile_id")
        except ValueError as error:
            return self.error(str(error), 400)

        self.db.conversations.update(
            conversation_id=conversation_id,
            title=data.get("title", conversation["title"]),
            project_id=project_id,
            profile_id=profile_id,
            provider=data.get("provider", conversation["provider"]),
            model=data.get("model", conversation["model"]),
        )
        return self.ok({"conversation": self.db.conversations.get(conversation_id)})

    def handle_conversations_delete(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        try:
            conversation_id = self.parse_int(request.args.get("id"), "id")
            self.require_fields({"id": conversation_id}, "id")
        except ValueError as error:
            return self.error(str(error), 400)

        conversation = self.db.conversations.get(conversation_id)
        if not conversation:
            return self.error("Conversation not found", 404)

        self.db.conversations.delete(conversation_id)
        return self.ok({"deleted": True, "conversation_id": conversation_id})
