import json


class ProviderSettingsResolver:
    def __init__(self, db_manager=None):
        self.db_manager = db_manager

    def get_setting(self, key, default=None):
        if not self.db_manager:
            return default

        setting = self.db_manager.settings.get(key)
        if not setting:
            return default

        return setting.get("value", default)

    def get_cloud_api_key(self, provider_name, fallback_key=None):
        parsed_keys = self._parse_cloud_api_keys(self.get_setting("openai_api_key"))

        if isinstance(parsed_keys, dict):
            provider_key = parsed_keys.get(provider_name)
            if provider_key:
                return provider_key
            return fallback_key

        if parsed_keys:
            return parsed_keys

        return fallback_key

    def _parse_cloud_api_keys(self, raw_value):
        if raw_value is None:
            return {}

        if isinstance(raw_value, dict):
            return raw_value

        if not isinstance(raw_value, str):
            return {}

        normalized = raw_value.strip()
        if not normalized:
            return {}

        try:
            parsed = json.loads(normalized)
        except json.JSONDecodeError:
            return normalized

        return parsed if isinstance(parsed, dict) else normalized
