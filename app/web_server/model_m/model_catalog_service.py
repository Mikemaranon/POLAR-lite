from .exceptions import ProviderError


class ModelCatalogService:
    def __init__(self, db_manager=None):
        self.db_manager = db_manager

    def list_models(self, provider_name=None, providers=None):
        providers = providers or {}
        if provider_name:
            return self._list_provider_models(providers[provider_name])

        return {
            "providers": [
                self._list_provider_models(provider)
                for provider in providers.values()
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
