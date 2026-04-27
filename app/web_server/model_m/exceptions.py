class ProviderError(Exception):
    default_code = "provider_error"
    default_status_code = 500

    def __init__(
        self,
        message,
        *,
        provider=None,
        code=None,
        status_code=None,
        details=None,
    ):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.code = code or self.default_code
        self.status_code = status_code or self.default_status_code
        self.details = details or {}

    def to_dict(self):
        payload = {
            "code": self.code,
            "message": self.message,
        }
        if self.provider:
            payload["provider"] = self.provider
        if self.details:
            payload["details"] = self.details
        return payload


class UnsupportedProviderError(ProviderError):
    default_code = "unsupported_provider"
    default_status_code = 400


class ProviderUnavailableError(ProviderError):
    default_code = "provider_unavailable"
    default_status_code = 503


class ModelOperationError(ProviderError):
    default_code = "model_operation_error"
    default_status_code = 502
