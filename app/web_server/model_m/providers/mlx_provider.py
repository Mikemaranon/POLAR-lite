from importlib.util import find_spec
from pathlib import Path

from ..exceptions import ModelOperationError, ProviderUnavailableError
from .base_provider import ModelProvider


class MLXProvider(ModelProvider):
    provider_name = "mlx"

    def is_available(self) -> bool:
        return find_spec("mlx_lm") is not None

    def list_models(self) -> list[dict]:
        models = []

        for model_path in self.config.mlx_model_paths:
            path = Path(model_path).expanduser()
            if not path.exists():
                continue

            if path.is_dir():
                models.append(
                    {
                        "id": path.name,
                        "provider": self.provider_name,
                        "source": str(path),
                    }
                )

        return models

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        if not self.is_available():
            raise ProviderUnavailableError(
                "mlx_lm is not installed. Install it before using the MLX provider."
            )

        raise ModelOperationError(
            "MLX chat execution is scaffolded but not implemented yet."
        )
