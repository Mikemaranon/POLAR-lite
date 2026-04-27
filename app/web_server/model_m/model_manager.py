from config_m import ConfigManager

from .provider_manager import ProviderManager


class ModelManager:
    def __init__(self, config_manager: ConfigManager, db_manager=None):
        self.config_manager = config_manager
        self.db_manager = db_manager
        self.provider_manager = ProviderManager(config_manager, db_manager=db_manager)

    def list_models(self, provider_name: str | None = None) -> dict:
        return self.provider_manager.list_models(provider_name)

    def chat(
        self,
        provider_name: str,
        messages: list[dict],
        model: str,
        settings: dict | None = None,
    ) -> dict:
        return self.provider_manager.chat(provider_name, messages, model, settings or {})
