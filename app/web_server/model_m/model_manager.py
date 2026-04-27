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

    def stream_chat(
        self,
        provider_name: str,
        messages: list[dict],
        model: str,
        settings: dict | None = None,
    ):
        return self.provider_manager.stream_chat(provider_name, messages, model, settings or {})

    def generate_conversation_title(
        self,
        provider_name: str,
        model: str,
        first_user_message: str,
    ) -> str:
        return self.provider_manager.generate_conversation_title(
            provider_name,
            model,
            first_user_message,
        )
