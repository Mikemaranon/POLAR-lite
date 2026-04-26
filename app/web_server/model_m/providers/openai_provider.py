from ..exceptions import ModelOperationError, ProviderUnavailableError
from .base_provider import ModelProvider


class OpenAIProvider(ModelProvider):
    provider_name = "openai"

    def is_available(self) -> bool:
        return bool(self.config.openai_api_key)

    def list_models(self) -> list[dict]:
        return []

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        if not self.is_available():
            raise ProviderUnavailableError(
                "OpenAI provider requires OPENAI_API_KEY or a saved API key."
            )

        raise ModelOperationError(
            "OpenAI chat execution is scaffolded but not implemented yet."
        )
