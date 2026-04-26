class ProviderError(Exception):
    pass


class UnsupportedProviderError(ProviderError):
    pass


class ProviderUnavailableError(ProviderError):
    pass


class ModelOperationError(ProviderError):
    pass
