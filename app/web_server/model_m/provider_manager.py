from config_m import ConfigManager

from .exceptions import ProviderError, UnsupportedProviderError
from .http_client import JsonHttpClient
from .providers import (
    AnthropicProvider,
    GoogleProvider,
    MLXProvider,
    OllamaProvider,
    OpenAIProvider,
)


class ProviderManager:
    def __init__(self, config_manager: ConfigManager, db_manager=None):
        self.config_manager = config_manager
        self.db_manager = db_manager
        provider_config = self.config_manager.get_provider_config()
        self.http_client = JsonHttpClient(provider_config.request_timeout_seconds)

        self.providers = {
            "mlx": MLXProvider(provider_config, db_manager=db_manager),
            "ollama": OllamaProvider(
                provider_config,
                db_manager=db_manager,
                http_client=self.http_client,
            ),
            "openai": OpenAIProvider(
                provider_config,
                db_manager=db_manager,
                http_client=self.http_client,
            ),
            "anthropic": AnthropicProvider(
                provider_config,
                db_manager=db_manager,
                http_client=self.http_client,
            ),
            "google": GoogleProvider(
                provider_config,
                db_manager=db_manager,
                http_client=self.http_client,
            ),
        }

    def get_provider(self, provider_name: str):
        provider = self.providers.get(provider_name)
        if not provider:
            raise UnsupportedProviderError(
                f"Unsupported provider '{provider_name}'.",
                provider=provider_name,
            )
        return provider

    def list_models(self, provider_name: str | None = None) -> dict:
        if provider_name:
            provider = self.get_provider(provider_name)
            return self._list_provider_models(provider)

        return {
            "providers": [
                self._list_provider_models(provider)
                for provider in self.providers.values()
            ]
        }

    def _list_provider_models(self, provider):
        try:
            models = provider.list_models()
            self._sync_models_cache(provider.provider_name, models)
            availability_error = None
            if not provider.is_available():
                availability_error = provider.get_availability_error()
            return provider.build_catalog(models, error=availability_error)
        except ProviderError as error:
            cached_models = self._get_cached_models(provider.provider_name)
            return provider.build_catalog(cached_models, error=error)

    def chat(
        self,
        provider_name: str,
        messages: list[dict],
        model: str,
        settings: dict | None = None,
    ) -> dict:
        provider = self.get_provider(provider_name)
        return provider.chat(messages, model, settings or {})

    def get_registered_providers(self) -> list[str]:
        return list(self.providers.keys())

    def _sync_models_cache(self, provider_name, models):
        if not self.db_manager:
            return

        self.db_manager.models_cache.clear_provider(provider_name)
        for model in models:
            self.db_manager.models_cache.upsert(
                provider=provider_name,
                model_id=model["id"],
                display_name=model.get("display_name"),
                source=model.get("source"),
            )

    def _get_cached_models(self, provider_name):
        if not self.db_manager:
            return []

        cached_rows = self.db_manager.models_cache.list_models(provider_name)
        return [
            {
                "id": row["model_id"],
                "provider": row["provider"],
                "display_name": row["display_name"] or row["model_id"],
                "source": row.get("source"),
                "metadata": {
                    "cached": True,
                    "updated_at": row.get("updated_at"),
                },
            }
            for row in cached_rows
        ]
