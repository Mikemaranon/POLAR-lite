from ..exceptions import ModelOperationError
from .base_provider import ModelProvider


class OllamaProvider(ModelProvider):
    provider_name = "ollama"

    def list_models(self) -> list[dict]:
        return []

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        raise ModelOperationError(
            "Ollama chat execution is scaffolded but not implemented yet."
        )
