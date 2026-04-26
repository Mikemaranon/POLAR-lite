from config_m import ConfigManager

from .exceptions import UnsupportedProviderError
from .providers import MLXProvider, OllamaProvider, OpenAIProvider


class ProviderManager:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        provider_config = self.config_manager.get_provider_config()

        self.providers = {
            "mlx": MLXProvider(provider_config),
            "ollama": OllamaProvider(provider_config),
            "openai": OpenAIProvider(provider_config),
        }

    def get_provider(self, provider_name: str):
        provider = self.providers.get(provider_name)
        if not provider:
            raise UnsupportedProviderError(
                f"Unsupported provider '{provider_name}'."
            )
        return provider

    def list_models(self, provider_name: str | None = None) -> dict:
        if provider_name:
            provider = self.get_provider(provider_name)
            return {
                "provider": provider_name,
                "models": provider.list_models(),
            }

        catalog = {}
        for name, provider in self.providers.items():
            catalog[name] = provider.list_models()

        return catalog

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
