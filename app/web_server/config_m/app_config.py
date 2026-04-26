from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeConfig:
    secret_key: str
    host: str = "0.0.0.0"
    port: int = 5050
    debug: bool = True


@dataclass(frozen=True)
class ProviderConfig:
    default_provider: str = "mlx"
    ollama_base_url: str = "http://localhost:11434/api"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: str | None = None
    mlx_model_paths: tuple[str, ...] = ()
    request_timeout_seconds: int = 120
