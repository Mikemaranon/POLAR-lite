from tests.test_support import ApiTestCase
from model_m import ProviderUnavailableError


class ApiEndpointTests(ApiTestCase):
    def test_models_endpoint_returns_provider_catalog(self):
        self.model_manager.list_models = lambda provider=None: {
            "providers": [
                {
                    "provider": "mlx",
                    "available": True,
                    "models": [{"id": "gemma-3", "provider": "mlx"}],
                    "error": None,
                }
            ]
        }

        response = self.client.get("/api/models", headers=self.auth_headers)
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["providers"][0]["provider"], "mlx")

    def test_projects_profiles_and_conversations_can_be_created(self):
        project_response = self.client.post(
            "/api/projects",
            json={"name": "Demo Project", "description": "Sandbox"},
            headers=self.auth_headers,
        )
        profile_response = self.client.post(
            "/api/profiles",
            json={
                "name": "Precise",
                "system_prompt": "Be precise.",
                "temperature": 0.1,
                "top_p": 0.9,
                "max_tokens": 512,
            },
            headers=self.auth_headers,
        )

        project = project_response.get_json()["project"]
        profile = profile_response.get_json()["profile"]

        conversation_response = self.client.post(
            "/api/conversations",
            json={
                "title": "Planning",
                "project_id": project["id"],
                "profile_id": profile["id"],
                "provider": "ollama",
                "model": "gemma3",
            },
            headers=self.auth_headers,
        )
        conversation = conversation_response.get_json()["conversation"]

        self.assertEqual(project_response.status_code, 201)
        self.assertEqual(profile_response.status_code, 201)
        self.assertEqual(conversation_response.status_code, 201)
        self.assertEqual(conversation["project_id"], project["id"])
        self.assertEqual(conversation["profile_id"], profile["id"])
        self.assertEqual(conversation["provider"], "ollama")

    def test_chat_endpoint_applies_profile_and_persists_turn(self):
        profile_id = self.db.profiles.create(
            name="Creative",
            system_prompt="Answer creatively.",
            temperature=0.4,
            top_p=0.8,
            max_tokens=300,
            is_default=True,
        )
        conversation_id = self.db.conversations.create(
            title="Ideas",
            profile_id=profile_id,
            provider="openai",
            model="gpt-4.1",
        )

        captured = {}

        def fake_chat(provider, messages, model, settings):
            captured["provider"] = provider
            captured["messages"] = messages
            captured["model"] = model
            captured["settings"] = settings
            return {
                "provider": provider,
                "model": model,
                "message": {
                    "role": "assistant",
                    "content": "Aqui tienes ideas",
                },
                "message_id": "resp-1",
                "usage": {"completion_tokens": 12},
                "finish_reason": "stop",
                "raw": {},
            }

        self.model_manager.chat = fake_chat

        response = self.client.post(
            "/api/chat",
            json={
                "conversation_id": conversation_id,
                "messages": [{"role": "user", "content": "Dame ideas"}],
            },
            headers=self.auth_headers,
        )
        payload = response.get_json()
        stored_messages = self.db.messages.for_conversation(conversation_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["provider"], "openai")
        self.assertEqual(captured["model"], "gpt-4.1")
        self.assertEqual(captured["messages"][0]["role"], "system")
        self.assertEqual(captured["messages"][0]["content"], "Answer creatively.")
        self.assertEqual(captured["settings"]["temperature"], 0.4)
        self.assertEqual(payload["response"]["message"]["content"], "Aqui tienes ideas")
        self.assertEqual(len(stored_messages), 2)
        self.assertEqual(stored_messages[0]["content"], "Dame ideas")
        self.assertEqual(stored_messages[1]["provider_message_id"], "resp-1")

    def test_chat_endpoint_persists_user_message_even_when_provider_fails(self):
        conversation_id = self.db.conversations.create(
            title="Broken run",
            provider="mlx",
            model="mlx-community/gemma-3-4b-it-4bit",
        )

        def failing_chat(provider, messages, model, settings):
            raise ProviderUnavailableError("MLX offline", provider="mlx")

        self.model_manager.chat = failing_chat

        response = self.client.post(
            "/api/chat",
            json={
                "conversation_id": conversation_id,
                "messages": [{"role": "user", "content": "Guarda esto"}],
            },
            headers=self.auth_headers,
        )

        self.assertEqual(response.status_code, 503)
        stored_messages = self.db.messages.for_conversation(conversation_id)
        self.assertEqual(len(stored_messages), 1)
        self.assertEqual(stored_messages[0]["role"], "user")
        self.assertEqual(stored_messages[0]["content"], "Guarda esto")

    def test_chat_endpoint_persists_duplicate_user_messages_in_order(self):
        conversation_id = self.db.conversations.create(
            title="Duplicates",
            provider="mlx",
            model="mlx-community/gemma-3-4b-it-4bit",
        )

        replies = iter(["Primera respuesta", "Segunda respuesta"])

        def fake_chat(provider, messages, model, settings):
            return {
                "provider": provider,
                "model": model,
                "message": {
                    "role": "assistant",
                    "content": next(replies),
                },
                "message_id": None,
                "usage": {},
                "finish_reason": "stop",
                "raw": {},
            }

        self.model_manager.chat = fake_chat

        first_response = self.client.post(
            "/api/chat",
            json={
                "conversation_id": conversation_id,
                "messages": [{"role": "user", "content": "Hola"}],
            },
            headers=self.auth_headers,
        )
        second_response = self.client.post(
            "/api/chat",
            json={
                "conversation_id": conversation_id,
                "messages": [
                    {"role": "user", "content": "Hola"},
                    {"role": "assistant", "content": "Primera respuesta"},
                    {"role": "user", "content": "Hola"},
                ],
            },
            headers=self.auth_headers,
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)

        stored_messages = self.db.messages.for_conversation(conversation_id)
        self.assertEqual(
            [(message["role"], message["content"]) for message in stored_messages],
            [
                ("user", "Hola"),
                ("assistant", "Primera respuesta"),
                ("user", "Hola"),
                ("assistant", "Segunda respuesta"),
            ],
        )

    def test_settings_endpoint_persists_api_key(self):
        write_response = self.client.post(
            "/api/settings",
            json={"key": "openai_api_key", "value": "sk-test"},
            headers=self.auth_headers,
        )
        read_response = self.client.get(
            "/api/settings?key=openai_api_key",
            headers=self.auth_headers,
        )

        self.assertEqual(write_response.status_code, 201)
        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(read_response.get_json()["setting"]["value"], "sk-test")

    def test_profile_can_be_updated(self):
        profile_id = self.db.profiles.create(
            name="Research",
            system_prompt="Think step by step.",
            temperature=0.3,
            top_p=0.9,
            max_tokens=900,
        )

        response = self.client.patch(
            "/api/profiles",
            json={
                "id": profile_id,
                "name": "Research Pro",
                "personality": "Claro y técnico",
                "tags": ["code", "review"],
                "system_prompt": "Be structured and concise.",
                "temperature": 0.5,
                "top_p": 0.8,
                "max_tokens": 1200,
                "is_default": True,
            },
            headers=self.auth_headers,
        )
        profile = self.db.profiles.get(profile_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["profile"]["name"], "Research Pro")
        self.assertEqual(response.get_json()["profile"]["personality"], "Claro y técnico")
        self.assertEqual(profile["system_prompt"], "Be structured and concise.")
        self.assertEqual(profile["tags"], ["code", "review"])
        self.assertEqual(profile["temperature"], 0.5)
        self.assertTrue(profile["is_default"])

    def test_profile_can_be_deleted(self):
        profile_id = self.db.profiles.create(
            name="Temporary Profile",
            personality="Breve",
            tags=["tmp"],
        )

        response = self.client.delete(
            f"/api/profiles?id={profile_id}",
            headers=self.auth_headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["deleted"])
        self.assertIsNone(self.db.profiles.get(profile_id))

    def test_last_profile_cannot_be_deleted(self):
        default_profile = self.db.profiles.get_default()

        response = self.client.delete(
            f"/api/profiles?id={default_profile['id']}",
            headers=self.auth_headers,
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("último perfil", response.get_json()["error"])

    def test_conversation_can_be_deleted(self):
        conversation_id = self.db.conversations.create(
            title="Temporary",
            provider="mlx",
            model="gemma-3",
        )
        self.db.messages.create(
            conversation_id=conversation_id,
            role="user",
            content="Borrar esto",
        )

        response = self.client.delete(
            f"/api/conversations?id={conversation_id}",
            headers=self.auth_headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["deleted"])
        self.assertIsNone(self.db.conversations.get(conversation_id))
        self.assertEqual(self.db.messages.for_conversation(conversation_id), [])

    def test_conversation_profile_can_be_updated(self):
        profile_id = self.db.profiles.create(name="Research")
        conversation_id = self.db.conversations.create(
            title="Temporary",
            provider="mlx",
            model="gemma-3",
        )

        response = self.client.patch(
            "/api/conversations",
            json={"id": conversation_id, "profile_id": profile_id},
            headers=self.auth_headers,
        )
        conversation = self.db.conversations.get(conversation_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["conversation"]["profile_id"], profile_id)
        self.assertEqual(conversation["profile_id"], profile_id)

    def test_project_can_be_deleted_without_deleting_chats(self):
        project_id = self.db.projects.create("Temporary Project", "Delete me")
        conversation_id = self.db.conversations.create(
            title="Keep chat",
            project_id=project_id,
            provider="mlx",
            model="gemma-3",
        )

        response = self.client.delete(
            f"/api/projects?id={project_id}",
            headers=self.auth_headers,
        )
        conversation = self.db.conversations.get(conversation_id)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["deleted"])
        self.assertIsNone(self.db.projects.get(project_id))
        self.assertIsNotNone(conversation)
        self.assertIsNone(conversation["project_id"])

    def test_endpoints_require_authentication(self):
        response = self.client.get("/api/projects")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["error"], "Unauthorized")
