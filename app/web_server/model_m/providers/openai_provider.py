from ..exceptions import ProviderUnavailableError
from ..http_client import JsonHttpClient
from .base_provider import ModelProvider


class OpenAIProvider(ModelProvider):
    provider_name = "openai"

    def __init__(self, config, db_manager=None, http_client=None):
        super().__init__(config, db_manager=db_manager, http_client=http_client)
        self.http_client = http_client or JsonHttpClient(config.request_timeout_seconds)

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    def list_models(self) -> list[dict]:
        api_key = self._get_api_key()
        if not api_key:
            raise ProviderUnavailableError(
                "OpenAI provider requires OPENAI_API_KEY or a saved API key.",
                provider=self.provider_name,
            )

        response = self.http_client.get_json(
            f"{self.config.openai_base_url}/models",
            headers=self._build_headers(api_key),
            provider_name=self.provider_name,
        )

        models = []
        for item in response.get("data", []):
            model_id = item.get("id")
            if not model_id:
                continue

            models.append(
                self.normalize_model_entry(
                    model_id=model_id,
                    display_name=model_id,
                    source="openai",
                    metadata={
                        "owned_by": item.get("owned_by"),
                        "created": item.get("created"),
                    },
                )
            )

        return models

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        api_key = self._get_api_key()
        if not api_key:
            raise ProviderUnavailableError(
                "OpenAI provider requires OPENAI_API_KEY or a saved API key.",
                provider=self.provider_name,
            )

        payload = self._build_chat_payload(messages, model, settings, stream=False)

        response = self.http_client.post_json(
            f"{self.config.openai_base_url}/chat/completions",
            payload,
            headers=self._build_headers(api_key),
            provider_name=self.provider_name,
        )

        choice = (response.get("choices") or [{}])[0]
        message = choice.get("message", {})
        return self.normalize_chat_response(
            model=response.get("model", model),
            content=message.get("content", "") or "",
            usage=response.get("usage", {}),
            finish_reason=choice.get("finish_reason"),
            raw_response=response,
            message_id=response.get("id"),
        )

    def stream_chat(self, messages: list[dict], model: str, settings: dict | None = None):
        api_key = self._get_api_key()
        if not api_key:
            raise ProviderUnavailableError(
                "OpenAI provider requires OPENAI_API_KEY or a saved API key.",
                provider=self.provider_name,
            )

        payload = self._build_chat_payload(messages, model, settings, stream=True)
        content_parts = []
        usage = {}
        finish_reason = None
        response_model = model
        message_id = None
        chunk_count = 0

        for chunk in self.http_client.stream_sse_json(
            f"{self.config.openai_base_url}/chat/completions",
            payload,
            headers=self._build_headers(api_key),
            provider_name=self.provider_name,
        ):
            chunk_count += 1
            response_model = chunk.get("model", response_model)
            message_id = chunk.get("id") or message_id
            if chunk.get("usage"):
                usage = chunk["usage"]

            choice = (chunk.get("choices") or [{}])[0]
            delta = choice.get("delta") or {}
            text = delta.get("content") or ""
            if text:
                content_parts.append(text)
                yield {
                    "type": "delta",
                    "delta": text,
                }

            if choice.get("finish_reason") is not None:
                finish_reason = choice.get("finish_reason")

        yield {
            "type": "response",
            "response": self.normalize_chat_response(
                model=response_model,
                content="".join(content_parts),
                usage=usage,
                finish_reason=finish_reason,
                raw_response={
                    "streamed": True,
                    "chunk_count": chunk_count,
                },
                message_id=message_id,
            ),
        }

    def _build_chat_payload(self, messages, model, settings, *, stream):
        payload = {
            "model": model,
            "messages": self.normalize_messages(messages),
            "stream": stream,
        }

        if stream:
            payload["stream_options"] = {"include_usage": True}

        common = self.get_common_generation_settings(settings)
        if common.get("temperature") is not None:
            payload["temperature"] = common["temperature"]
        if common.get("top_p") is not None:
            payload["top_p"] = common["top_p"]
        if common.get("max_tokens") is not None:
            payload["max_completion_tokens"] = common["max_tokens"]
        if common.get("stop") is not None:
            payload["stop"] = common["stop"]

        return payload

    def _get_api_key(self):
        return self.get_cloud_api_key(self.config.openai_api_key)

    def _build_headers(self, api_key):
        return {
            "Authorization": f"Bearer {api_key}",
        }
