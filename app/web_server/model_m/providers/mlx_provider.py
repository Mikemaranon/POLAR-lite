import inspect
from importlib.util import find_spec
from pathlib import Path
import threading

from ..exceptions import ModelOperationError, ProviderUnavailableError
from .base_provider import ModelProvider


class MLXProvider(ModelProvider):
    provider_name = "mlx"

    def __init__(self, config, db_manager=None, http_client=None):
        super().__init__(config, db_manager=db_manager, http_client=http_client)
        self._loaded_models = {}
        self._model_lock = threading.Lock()

    def is_available(self) -> bool:
        return find_spec("mlx_lm") is not None

    def get_availability_error(self):
        if self.is_available():
            return None

        return ProviderUnavailableError(
            "MLX runtime unavailable: install `mlx_lm` in the server environment to enable local inference.",
            provider=self.provider_name,
        )

    def list_models(self) -> list[dict]:
        discovered_models = {}

        for path in self._get_configured_model_paths():
            discovered_models[path.name] = self.normalize_model_entry(
                model_id=path.name,
                display_name=path.name,
                source=str(path),
                metadata={
                    "path": str(path),
                    "origin": "local",
                },
            )

        for repo_id, snapshot_path in self._get_cached_huggingface_models().items():
            discovered_models[repo_id] = self.normalize_model_entry(
                model_id=repo_id,
                display_name=repo_id.split("/")[-1],
                source=str(snapshot_path),
                metadata={
                    "path": str(snapshot_path),
                    "origin": "huggingface_cache",
                },
            )

        return sorted(discovered_models.values(), key=lambda item: item["id"])

    def chat(self, messages: list[dict], model: str, settings: dict | None = None) -> dict:
        if not self.is_available():
            raise ProviderUnavailableError(
                "mlx_lm is not installed. Install it before using the MLX provider.",
                provider=self.provider_name,
            )

        load_fn, generate_fn = self._import_mlx_runtime()
        resolved_model = self._resolve_model_target(model)
        model_instance, tokenizer = self._get_or_load_model(load_fn, resolved_model)

        prompt = self._build_prompt(tokenizer, self.normalize_messages(messages))
        generation_kwargs = self._build_generation_kwargs(generate_fn, prompt, settings)

        try:
            content = generate_fn(model_instance, tokenizer, **generation_kwargs)
        except Exception as error:
            raise ModelOperationError(
                f"MLX generation failed: {error}",
                provider=self.provider_name,
            ) from error

        return self.normalize_chat_response(
            model=model,
            content=str(content),
            usage={
                "prompt_characters": len(prompt),
                "completion_characters": len(str(content)),
            },
            finish_reason="stop",
            raw_response={
                "resolved_model": str(resolved_model),
            },
        )

    def _import_mlx_runtime(self):
        try:
            from mlx_lm import generate, load
        except ImportError as error:
            raise ProviderUnavailableError(
                "mlx_lm is not installed. Install it before using the MLX provider.",
                provider=self.provider_name,
            ) from error

        return load, generate

    def _get_or_load_model(self, load_fn, resolved_model):
        cache_key = str(resolved_model)
        with self._model_lock:
            if cache_key not in self._loaded_models:
                try:
                    self._loaded_models[cache_key] = load_fn(cache_key)
                except Exception as error:
                    raise ModelOperationError(
                        f"Could not load MLX model '{cache_key}': {error}",
                        provider=self.provider_name,
                    ) from error

            return self._loaded_models[cache_key]

    def _build_prompt(self, tokenizer, messages):
        if hasattr(tokenizer, "apply_chat_template"):
            kwargs = {"add_generation_prompt": True}
            signature = inspect.signature(tokenizer.apply_chat_template)
            if "tokenize" in signature.parameters:
                kwargs["tokenize"] = False

            return tokenizer.apply_chat_template(messages, **kwargs)

        transcript = []
        for message in messages:
            transcript.append(f"{message['role'].upper()}: {message['content']}")
        transcript.append("ASSISTANT:")
        return "\n".join(transcript)

    def _build_generation_kwargs(self, generate_fn, prompt, settings):
        signature = inspect.signature(generate_fn)
        common = self.get_common_generation_settings(settings)
        kwargs = {
            "prompt": prompt,
        }

        if "verbose" in signature.parameters:
            kwargs["verbose"] = False
        if common.get("max_tokens") is not None and "max_tokens" in signature.parameters:
            kwargs["max_tokens"] = common["max_tokens"]
        if common.get("temperature") is not None:
            if "temperature" in signature.parameters:
                kwargs["temperature"] = common["temperature"]
            elif "temp" in signature.parameters:
                kwargs["temp"] = common["temperature"]
        if common.get("top_p") is not None and "top_p" in signature.parameters:
            kwargs["top_p"] = common["top_p"]

        return kwargs

    def _resolve_model_target(self, model):
        direct_path = Path(model).expanduser()
        if direct_path.exists():
            return direct_path

        configured_models = {path.name: path for path in self._get_configured_model_paths()}
        if model in configured_models:
            return configured_models[model]

        cached_models = self._get_cached_huggingface_models()
        if model in cached_models:
            return cached_models[model]

        return model

    def _get_configured_model_paths(self):
        model_paths = []
        for model_path in self.config.mlx_model_paths:
            path = Path(model_path).expanduser()
            if path.exists() and path.is_dir():
                model_paths.append(path)
        return model_paths

    def _get_cached_huggingface_models(self):
        cache_root = self._get_huggingface_cache_root()
        if not cache_root.exists():
            return {}

        models = {}
        for candidate in cache_root.iterdir():
            if not candidate.is_dir() or not candidate.name.startswith("models--"):
                continue

            repo_id = candidate.name.replace("models--", "", 1).replace("--", "/")
            snapshot_path = self._latest_snapshot(candidate)
            if snapshot_path:
                models[repo_id] = snapshot_path

        return models

    def _get_huggingface_cache_root(self):
        if self.config.huggingface_cache_dir:
            return Path(self.config.huggingface_cache_dir).expanduser()

        hf_home = Path.home() / ".cache" / "huggingface"
        return hf_home / "hub"

    def _latest_snapshot(self, cache_repo_dir):
        snapshots_dir = cache_repo_dir / "snapshots"
        if not snapshots_dir.exists():
            return None

        snapshots = [path for path in snapshots_dir.iterdir() if path.is_dir()]
        if not snapshots:
            return None

        return max(snapshots, key=lambda path: path.stat().st_mtime)
