class ChatContextBuilder:
    def __init__(self, db_manager):
        self.db = db_manager

    def resolve_project(self, project_id, conversation):
        if project_id is not None:
            project = self.db.projects.get(project_id)
            if not project:
                raise ValueError("Project not found")
            return project

        if conversation and conversation.get("project_id"):
            return self.db.projects.get(conversation["project_id"])

        return None

    def resolve_profile(self, profile_id, conversation, default_profile):
        if profile_id is not None:
            return self.db.profiles.get(profile_id)

        if conversation and conversation.get("profile_id"):
            return self.db.profiles.get(conversation["profile_id"])

        return default_profile

    def build_input_messages(self, project, profile, messages):
        normalized_messages = []
        system_prompt = self._build_combined_system_prompt(project, profile)
        if system_prompt:
            normalized_messages.append(
                {
                    "role": "system",
                    "content": system_prompt,
                }
            )

        normalized_messages.extend(messages)
        return normalized_messages

    def build_generation_settings(self, profile, override_settings):
        settings = {}

        if profile:
            settings["temperature"] = profile.get("temperature")
            settings["top_p"] = profile.get("top_p")
            settings["max_tokens"] = profile.get("max_tokens")

        if override_settings:
            settings.update(override_settings)

        return settings

    def _build_combined_system_prompt(self, project, profile):
        parts = []

        project_context_message = self._build_project_context_message(project)
        if project_context_message:
            parts.append(project_context_message)

        if profile and profile.get("system_prompt"):
            parts.append(profile["system_prompt"])

        return "\n\n".join(part for part in parts if part)

    def _build_project_context_message(self, project):
        if not project:
            return ""

        parts = [f"Proyecto activo: {project['name']}"]

        if project.get("description"):
            parts.append(f"Descripción del proyecto:\n{project['description']}")

        if project.get("system_prompt"):
            parts.append(f"Instrucciones del proyecto:\n{project['system_prompt']}")

        documents = self.db.project_documents.for_project(project["id"])
        documents_block = self._build_project_documents_context(documents)
        if documents_block:
            parts.append(documents_block)

        return "\n\n".join(part for part in parts if part)

    def _build_project_documents_context(self, documents):
        if not documents:
            return ""

        max_total_chars = 12_000
        max_document_chars = 4_000
        consumed = 0
        blocks = []

        for index, document in enumerate(documents, start=1):
            header = f"[Documento {index}] {document['filename']}\n"
            body = (document.get("text_content") or "").strip()
            if not body:
                continue

            if len(body) > max_document_chars:
                body = (
                    f"{body[:max_document_chars].rstrip()}\n"
                    "[Documento truncado para el contexto del chat.]"
                )

            block = f"{header}{body}"
            projected_size = consumed + len(block)
            if projected_size > max_total_chars:
                remaining = max_total_chars - consumed
                if remaining <= len(header) + 64:
                    break

                available_body = remaining - len(header) - len(
                    "\n[Documento truncado para el contexto del chat.]"
                )
                trimmed_body = body[:available_body].rstrip()
                block = (
                    f"{header}{trimmed_body}\n"
                    "[Documento truncado para el contexto del chat.]"
                )

            blocks.append(block)
            consumed += len(block)

            if consumed >= max_total_chars:
                break

        if not blocks:
            return ""

        return "Documentos adjuntos del proyecto:\n\n" + "\n\n".join(blocks)
