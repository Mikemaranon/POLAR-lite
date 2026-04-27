from abc import ABC, abstractmethod
import json

from config_m import ProviderConfig

from ..exceptions import ModelOperationError

class ModelProvider(ABC):
    provider_name = "base"

    def __init__(self, config: ProviderConfig, db_manager=None, http_client=None):
        self.config = config
        self.db_manager = db_manager
        self.http_client = http_client

    def is_available(self) -> bool:
        return True

    def get_availability_error(self):
        return None

    @abstractmethod
    def list_models(self) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        raise NotImplementedError

    def stream_chat(
        self,
        messages: list[dict],
        model: str,
        settings: dict | None = None,
    ):
        response = self.chat(messages, model, settings)
        content = (response.get("message") or {}).get("content", "")

        if content:
            yield {
                "type": "delta",
                "delta": content,
            }

        yield {
            "type": "response",
            "response": response,
        }

    def get_setting(self, key: str, default=None):
        if not self.db_manager:
            return default

        setting = self.db_manager.settings.get(key)
        if not setting:
            return default
        return setting.get("value", default)

    def get_cloud_api_key(self, fallback_key=None):
        fallback_key = fallback_key or getattr(self.config, f"{self.provider_name}_api_key", None)
        stored_value = self.get_setting("openai_api_key")
        parsed_keys = self._parse_cloud_api_keys(stored_value)

        if isinstance(parsed_keys, dict):
            provider_key = parsed_keys.get(self.provider_name)
            if provider_key:
                return provider_key
            return fallback_key

        if parsed_keys:
            return parsed_keys

        return fallback_key

    def normalize_messages(self, messages: list[dict]) -> list[dict]:
        normalized_messages = []

        for raw_message in messages or []:
            role = raw_message.get("role")
            if not role:
                raise ModelOperationError(
                    "Each message must define a role.",
                    provider=self.provider_name,
                )

            content = self._normalize_content(raw_message.get("content", ""))
            normalized_messages.append(
                {
                    "role": role,
                    "content": content,
                }
            )

        return normalized_messages

    def normalize_model_entry(
        self,
        *,
        model_id: str,
        display_name: str | None = None,
        source=None,
        metadata=None,
    ) -> dict:
        return {
            "id": model_id,
            "provider": self.provider_name,
            "display_name": display_name or model_id,
            "source": source,
            "metadata": metadata or {},
        }

    def normalize_chat_response(
        self,
        *,
        model: str,
        content: str,
        usage=None,
        finish_reason=None,
        raw_response=None,
        message_id=None,
    ) -> dict:
        return {
            "provider": self.provider_name,
            "model": model,
            "message": {
                "role": "assistant",
                "content": content,
            },
            "usage": usage or {},
            "finish_reason": finish_reason,
            "message_id": message_id,
            "raw": raw_response or {},
        }

    def build_catalog(self, models: list[dict], error=None) -> dict:
        return {
            "provider": self.provider_name,
            "available": error is None and self.is_available(),
            "models": models,
            "error": error.to_dict() if error else None,
        }

    def get_common_generation_settings(self, settings: dict | None = None) -> dict:
        settings = settings or {}
        normalized = {}

        if settings.get("temperature") is not None:
            normalized["temperature"] = float(settings["temperature"])
        if settings.get("top_p") is not None:
            normalized["top_p"] = float(settings["top_p"])
        if settings.get("max_tokens") is not None:
            normalized["max_tokens"] = int(settings["max_tokens"])
        if settings.get("stop") is not None:
            normalized["stop"] = settings["stop"]

        return normalized

    def _normalize_content(self, content) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                    continue

                if isinstance(item, dict):
                    text = item.get("text")
                    if text:
                        parts.append(text)
            return "\n".join(parts)

        if content is None:
            return ""

        return str(content)

    def _parse_cloud_api_keys(self, raw_value):
        if raw_value is None:
            return {}

        if isinstance(raw_value, dict):
            return raw_value

        if not isinstance(raw_value, str):
            return {}

        normalized = raw_value.strip()
        if not normalized:
            return {}

        try:
            parsed = json.loads(normalized)
        except json.JSONDecodeError:
            return normalized

        return parsed if isinstance(parsed, dict) else normalized
