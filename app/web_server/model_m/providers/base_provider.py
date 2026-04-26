from abc import ABC, abstractmethod

from config_m import ProviderConfig


class ModelProvider(ABC):
    provider_name = "base"

    def __init__(self, config: ProviderConfig):
        self.config = config

    def is_available(self) -> bool:
        return True

    @abstractmethod
    def list_models(self) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        raise NotImplementedError
