from ..exceptions import ModelOperationError
from ..http_client import JsonHttpClient
from .base_provider import ModelProvider


class OllamaProvider(ModelProvider):
    provider_name = "ollama"

    def __init__(self, config, db_manager=None, http_client=None):
        super().__init__(config, db_manager=db_manager, http_client=http_client)
        self.http_client = http_client or JsonHttpClient(config.request_timeout_seconds)

    def list_models(self) -> list[dict]:
        response = self.http_client.get_json(
            f"{self.config.ollama_base_url}/tags",
            headers=self._build_headers(),
            provider_name=self.provider_name,
        )
        self._raise_if_error_response(response)

        models = []
        for item in response.get("models", []):
            model_id = item.get("model") or item.get("name")
            if not model_id:
                continue

            models.append(
                self.normalize_model_entry(
                    model_id=model_id,
                    display_name=item.get("name") or model_id,
                    source="ollama",
                    metadata={
                        "modified_at": item.get("modified_at"),
                        "size": item.get("size"),
                        "digest": item.get("digest"),
                        "details": item.get("details", {}),
                    },
                )
            )

        return models

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        payload = {
            "model": model,
            "messages": self.normalize_messages(messages),
            "stream": False,
        }

        options = self._build_options(settings)
        if options:
            payload["options"] = options

        response = self.http_client.post_json(
            f"{self.config.ollama_base_url}/chat",
            payload,
            headers=self._build_headers(),
            provider_name=self.provider_name,
        )
        self._raise_if_error_response(response, model=model)

        message = response.get("message", {})
        return self.normalize_chat_response(
            model=response.get("model", model),
            content=message.get("content", ""),
            usage={
                "prompt_tokens": response.get("prompt_eval_count"),
                "completion_tokens": response.get("eval_count"),
                "total_duration": response.get("total_duration"),
                "load_duration": response.get("load_duration"),
            },
            finish_reason=response.get("done_reason"),
            raw_response=response,
        )

    def _build_headers(self):
        api_key = self.get_setting("ollama_api_key", self.config.ollama_api_key)
        if not api_key:
            return {}
        return {"Authorization": f"Bearer {api_key}"}

    def _build_options(self, settings):
        common = self.get_common_generation_settings(settings)
        options = {}

        if common.get("temperature") is not None:
            options["temperature"] = common["temperature"]
        if common.get("top_p") is not None:
            options["top_p"] = common["top_p"]
        if common.get("max_tokens") is not None:
            options["num_predict"] = common["max_tokens"]
        if common.get("stop") is not None:
            options["stop"] = common["stop"]

        return options

    def _raise_if_error_response(self, response, model=None):
        if not isinstance(response, dict):
            return

        raw_error = response.get("error")
        if not raw_error:
            return

        message = str(raw_error)
        if "llama runner process has terminated" in message:
            resolved_model = f" para `{model}`" if model else ""
            message = (
                f"Ollama pudo encontrar el modelo{resolved_model}, pero su runner local se cerró "
                "durante la generación. Reinicia Ollama y prueba también `ollama run <modelo>` "
                "fuera de la app para confirmar que el modelo funciona."
            )

        raise ModelOperationError(
            message,
            provider=self.provider_name,
            details={"raw_error": raw_error},
        )
