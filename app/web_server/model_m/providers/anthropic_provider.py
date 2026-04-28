from .base_provider import ModelProvider
from ..exceptions import ProviderUnavailableError
from ..http_client import JsonHttpClient


class AnthropicProvider(ModelProvider):
    provider_name = "anthropic"
    api_version = "2023-06-01"

    def __init__(self, config, db_manager=None, http_client=None, settings_resolver=None):
        super().__init__(
            config,
            db_manager=db_manager,
            http_client=http_client,
            settings_resolver=settings_resolver,
        )
        self.http_client = http_client or JsonHttpClient(config.request_timeout_seconds)

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    def list_models(self) -> list[dict]:
        api_key = self._get_api_key()
        if not api_key:
            raise ProviderUnavailableError(
                "Anthropic provider requires a saved cloud API key.",
                provider=self.provider_name,
            )

        response = self.http_client.get_json(
            f"{self.config.anthropic_base_url}/v1/models",
            headers=self._build_headers(api_key),
            provider_name=self.provider_name,
        )

        return [
            self.normalize_model_entry(
                model_id=item["id"],
                display_name=item.get("display_name") or item["id"],
                source="anthropic",
                metadata={
                    "created_at": item.get("created_at"),
                    "type": item.get("type"),
                },
            )
            for item in response.get("data", [])
            if item.get("id")
        ]

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        api_key = self._get_api_key()
        if not api_key:
            raise ProviderUnavailableError(
                "Anthropic provider requires a saved cloud API key.",
                provider=self.provider_name,
            )

        normalized_messages = self.normalize_messages(messages)
        system_prompt, conversation_messages = self._split_system_messages(normalized_messages)
        common = self.get_common_generation_settings(settings)

        payload = {
            "model": model,
            "messages": conversation_messages,
            "max_tokens": common.get("max_tokens", 1024),
        }

        if system_prompt:
            payload["system"] = system_prompt
        if common.get("temperature") is not None:
            payload["temperature"] = common["temperature"]
        if common.get("top_p") is not None:
            payload["top_p"] = common["top_p"]
        if common.get("stop") is not None:
            payload["stop_sequences"] = common["stop"]

        response = self.http_client.post_json(
            f"{self.config.anthropic_base_url}/v1/messages",
            payload,
            headers=self._build_headers(api_key),
            provider_name=self.provider_name,
        )

        return self.normalize_chat_response(
            model=response.get("model", model),
            content=self._extract_text_response(response),
            usage=response.get("usage", {}),
            finish_reason=response.get("stop_reason"),
            raw_response=response,
            message_id=response.get("id"),
        )

    def _get_api_key(self):
        return self.settings_resolver.get_cloud_api_key(
            self.provider_name,
            self.config.anthropic_api_key,
        )

    def _build_headers(self, api_key):
        return {
            "x-api-key": api_key,
            "anthropic-version": self.api_version,
        }

    def _split_system_messages(self, messages):
        system_parts = []
        conversation_messages = []

        for message in messages:
            if message["role"] == "system":
                system_parts.append(message["content"])
                continue

            conversation_messages.append(message)

        return "\n\n".join(part for part in system_parts if part), conversation_messages

    def _extract_text_response(self, response):
        parts = []
        for item in response.get("content", []):
            if item.get("type") == "text" and item.get("text"):
                parts.append(item["text"])
        return "\n".join(parts)
