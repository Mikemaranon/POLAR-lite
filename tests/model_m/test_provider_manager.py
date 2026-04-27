import os
import tempfile
import unittest
from pathlib import Path

from config_m import ConfigManager
from model_m import ModelOperationError, ProviderUnavailableError, UnsupportedProviderError
from model_m.provider_manager import ProviderManager
from model_m.providers.mlx_provider import MLXProvider
from tests.test_support import IsolatedDatabaseTestCase


class FakeHttpClient:
    def __init__(self, *, get_response=None, post_response=None):
        self.get_response = get_response or {}
        self.post_response = post_response or {}
        self.calls = []

    def get_json(self, url, *, headers=None, provider_name=None):
        self.calls.append(
            {
                "method": "GET",
                "url": url,
                "headers": headers or {},
                "provider_name": provider_name,
            }
        )
        return self.get_response

    def post_json(self, url, payload, *, headers=None, provider_name=None):
        self.calls.append(
            {
                "method": "POST",
                "url": url,
                "payload": payload,
                "headers": headers or {},
                "provider_name": provider_name,
            }
        )
        return self.post_response


class ProviderManagerTests(unittest.TestCase):
    def tearDown(self):
        for key in [
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "GOOGLE_API_KEY",
            "MLX_MODEL_PATHS",
            "OLLAMA_API_KEY",
            "HUGGINGFACE_HUB_CACHE",
        ]:
            os.environ.pop(key, None)

    def test_registers_expected_providers(self):
        manager = ProviderManager(ConfigManager())

        self.assertEqual(
            manager.get_registered_providers(),
            ["mlx", "ollama", "openai", "anthropic", "google"],
        )

    def test_raises_for_unsupported_provider(self):
        manager = ProviderManager(ConfigManager())

        with self.assertRaises(UnsupportedProviderError):
            manager.get_provider("vertex")

    def test_openai_provider_requires_api_key(self):
        manager = ProviderManager(ConfigManager())

        with self.assertRaises(ProviderUnavailableError):
            manager.get_provider("openai").chat([], "gpt-4.1")

    def test_anthropic_provider_requires_api_key(self):
        manager = ProviderManager(ConfigManager())

        with self.assertRaises(ProviderUnavailableError):
            manager.get_provider("anthropic").chat([], "claude-sonnet-4")

    def test_google_provider_requires_api_key(self):
        manager = ProviderManager(ConfigManager())

        with self.assertRaises(ProviderUnavailableError):
            manager.get_provider("google").chat([], "gemini-2.5-flash")

    def test_mlx_provider_lists_existing_local_model_paths(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_a = Path(temp_dir) / "model-a"
            model_b = Path(temp_dir) / "model-b"
            empty_hf_cache = Path(temp_dir) / "hf-cache"
            model_a.mkdir()
            model_b.mkdir()
            empty_hf_cache.mkdir()
            os.environ["MLX_MODEL_PATHS"] = f"{model_a},{model_b}"
            os.environ["HUGGINGFACE_HUB_CACHE"] = str(empty_hf_cache)

            manager = ProviderManager(ConfigManager())
            models = manager.list_models("mlx")["models"]

            self.assertEqual(len(models), 2)
            self.assertEqual(
                [model["id"] for model in models],
                ["model-a", "model-b"],
            )

    def test_openai_provider_lists_models_via_http(self):
        os.environ["OPENAI_API_KEY"] = "test-key"
        manager = ProviderManager(ConfigManager())
        fake_http = FakeHttpClient(
            get_response={
                "data": [
                    {"id": "gpt-4.1", "owned_by": "openai", "created": 123},
                ]
            }
        )
        provider = manager.get_provider("openai")
        provider.http_client = fake_http

        models = provider.list_models()

        self.assertEqual(models[0]["id"], "gpt-4.1")
        self.assertEqual(fake_http.calls[0]["headers"]["Authorization"], "Bearer test-key")
        self.assertTrue(fake_http.calls[0]["url"].endswith("/models"))

    def test_ollama_provider_chat_maps_common_settings(self):
        manager = ProviderManager(ConfigManager())
        fake_http = FakeHttpClient(
            post_response={
                "model": "gemma3",
                "message": {"role": "assistant", "content": "Hola"},
                "done_reason": "stop",
                "prompt_eval_count": 10,
                "eval_count": 4,
            }
        )
        provider = manager.get_provider("ollama")
        provider.http_client = fake_http

        response = provider.chat(
            [{"role": "user", "content": "Hola"}],
            "gemma3",
            {"temperature": 0.2, "top_p": 0.8, "max_tokens": 128},
        )

        payload = fake_http.calls[0]["payload"]
        self.assertEqual(payload["options"]["temperature"], 0.2)
        self.assertEqual(payload["options"]["top_p"], 0.8)
        self.assertEqual(payload["options"]["num_predict"], 128)
        self.assertEqual(response["message"]["content"], "Hola")
        self.assertEqual(response["usage"]["prompt_tokens"], 10)

    def test_ollama_provider_raises_for_json_error_payload(self):
        manager = ProviderManager(ConfigManager())
        fake_http = FakeHttpClient(
            post_response={
                "error": "llama runner process has terminated: %!w(<nil>)",
            }
        )
        provider = manager.get_provider("ollama")
        provider.http_client = fake_http

        with self.assertRaises(ModelOperationError) as error:
            provider.chat(
                [{"role": "user", "content": "Hola"}],
                "qwen2.5-coder:7b",
            )

        self.assertIn("runner local se cerró", str(error.exception))

    def test_anthropic_provider_chat_uses_messages_api_shape(self):
        os.environ["ANTHROPIC_API_KEY"] = "anthropic-key"
        manager = ProviderManager(ConfigManager())
        fake_http = FakeHttpClient(
            post_response={
                "id": "msg_123",
                "model": "claude-sonnet-4",
                "content": [{"type": "text", "text": "Hola desde Claude"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 12, "output_tokens": 7},
            }
        )
        provider = manager.get_provider("anthropic")
        provider.http_client = fake_http

        response = provider.chat(
            [
                {"role": "system", "content": "Sé breve"},
                {"role": "user", "content": "Hola"},
            ],
            "claude-sonnet-4",
            {"temperature": 0.3, "max_tokens": 256},
        )

        payload = fake_http.calls[0]["payload"]
        self.assertEqual(payload["system"], "Sé breve")
        self.assertEqual(payload["messages"][0]["role"], "user")
        self.assertEqual(payload["max_tokens"], 256)
        self.assertEqual(response["message"]["content"], "Hola desde Claude")

    def test_google_provider_lists_generate_content_models(self):
        os.environ["GOOGLE_API_KEY"] = "google-key"
        manager = ProviderManager(ConfigManager())
        fake_http = FakeHttpClient(
            get_response={
                "models": [
                    {
                        "name": "models/gemini-2.5-flash",
                        "baseModelId": "gemini-2.5-flash",
                        "displayName": "Gemini 2.5 Flash",
                        "supportedGenerationMethods": ["generateContent"],
                    },
                    {
                        "name": "models/embedding-001",
                        "baseModelId": "embedding-001",
                        "displayName": "Embedding",
                        "supportedGenerationMethods": ["embedContent"],
                    },
                ]
            }
        )
        provider = manager.get_provider("google")
        provider.http_client = fake_http

        models = provider.list_models()

        self.assertEqual([model["id"] for model in models], ["gemini-2.5-flash"])
        self.assertEqual(fake_http.calls[0]["headers"]["x-goog-api-key"], "google-key")

    def test_mlx_provider_chat_uses_supported_generation_kwargs(self):
        captured = {}

        class FakeTokenizer:
            def apply_chat_template(self, messages, add_generation_prompt=True, tokenize=False):
                captured["messages"] = messages
                return "PROMPT"

        def fake_load(model_name):
            captured["loaded_model"] = model_name
            return "MODEL", FakeTokenizer()

        def fake_generate(model, tokenizer, prompt, max_tokens=None, temp=None, top_p=None, verbose=None):
            captured["generate"] = {
                "model": model,
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temp": temp,
                "top_p": top_p,
                "verbose": verbose,
            }
            return "Respuesta"

        provider = MLXProvider(ConfigManager().get_provider_config())
        provider.is_available = lambda: True
        provider._import_mlx_runtime = lambda: (fake_load, fake_generate)

        response = provider.chat(
            [{"role": "user", "content": "Hola"}],
            "demo-model",
            {"temperature": 0.4, "top_p": 0.9, "max_tokens": 64},
        )

        self.assertEqual(captured["loaded_model"], "demo-model")
        self.assertEqual(captured["generate"]["prompt"], "PROMPT")
        self.assertEqual(captured["generate"]["max_tokens"], 64)
        self.assertEqual(captured["generate"]["temp"], 0.4)
        self.assertEqual(captured["generate"]["top_p"], 0.9)
        self.assertEqual(response["message"]["content"], "Respuesta")


class ProviderManagerCacheFallbackTests(IsolatedDatabaseTestCase):
    def test_cloud_providers_can_read_shared_settings_blob(self):
        from data_m import DBManager

        db = DBManager()
        db.settings.set(
            "openai_api_key",
            '{"openai":"sk-openai","anthropic":"sk-anthropic","google":"sk-google"}',
        )

        manager = ProviderManager(ConfigManager(), db_manager=db)

        self.assertEqual(manager.get_provider("openai")._get_api_key(), "sk-openai")
        self.assertEqual(manager.get_provider("anthropic")._get_api_key(), "sk-anthropic")
        self.assertEqual(manager.get_provider("google")._get_api_key(), "sk-google")

    def test_returns_cached_models_when_provider_listing_fails(self):
        from data_m import DBManager
        from model_m.exceptions import ProviderUnavailableError

        db = DBManager()
        db.models_cache.upsert(
            provider="openai",
            model_id="gpt-4.1",
            display_name="GPT-4.1",
            source="openai",
        )

        manager = ProviderManager(ConfigManager(), db_manager=db)
        provider = manager.get_provider("openai")

        def failing_list_models():
            raise ProviderUnavailableError(
                "OpenAI down",
                provider="openai",
            )

        provider.list_models = failing_list_models

        catalog = manager.list_models("openai")

        self.assertFalse(catalog["available"])
        self.assertEqual(catalog["models"][0]["id"], "gpt-4.1")
        self.assertTrue(catalog["models"][0]["metadata"]["cached"])
        self.assertEqual(catalog["error"]["code"], "provider_unavailable")

    def test_mlx_catalog_exposes_runtime_error_when_package_is_missing(self):
        from data_m import DBManager

        db = DBManager()
        manager = ProviderManager(ConfigManager(), db_manager=db)
        provider = manager.get_provider("mlx")
        provider.is_available = lambda: False
        provider.list_models = lambda: [
            {
                "id": "gemma-3",
                "provider": "mlx",
                "display_name": "gemma-3",
                "source": "/tmp/gemma-3",
                "metadata": {},
            }
        ]

        catalog = manager.list_models("mlx")

        self.assertFalse(catalog["available"])
        self.assertEqual(catalog["models"][0]["id"], "gemma-3")
        self.assertEqual(catalog["error"]["code"], "provider_unavailable")
        self.assertIn("mlx_lm", catalog["error"]["message"])
