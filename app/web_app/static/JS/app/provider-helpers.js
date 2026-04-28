import { elements } from "./dom.js";
import { state } from "./state.js";

const CLOUD_PROVIDERS = new Set(["openai", "anthropic", "google"]);
const ROOT_PROVIDER_LABELS = {
    cloud: "Cloud",
    mlx: "MLX",
    ollama: "Ollama",
};
const PROVIDER_LABELS = {
    anthropic: "Anthropic",
    cloud: "Cloud",
    google: "Google",
    mlx: "MLX",
    ollama: "Ollama",
    openai: "OpenAI",
};


export function getProviderCatalog(provider = getActualProvider()) {
    return state.providerCatalogs.find((catalog) => catalog.provider === provider) || null;
}


export function getProviderAvailabilityLabel(catalog) {
    if (!catalog || catalog.available !== false) {
        return "";
    }

    const message = String(catalog.error?.message || "").toLowerCase();
    if (message.includes("api key") || message.includes("requires")) {
        return " (configuración)";
    }
    if (message.includes("mlx runtime")) {
        return " (runtime)";
    }

    return " (offline)";
}


export function getSelectedProvider() {
    return elements.providerSelect.value
        || state.selectedProvider
        || getRootProviderForActualProvider(state.activeConversation?.provider)
        || "mlx";
}


export function getSelectedCloudProvider() {
    return elements.cloudProviderSelect?.value
        || state.selectedCloudProvider
        || getActualProviderFromConversation()
        || "openai";
}


export function getActualProvider() {
    return getSelectedProvider() === "cloud"
        ? getSelectedCloudProvider()
        : getSelectedProvider();
}


export function getActualProviderFromConversation() {
    return isCloudProvider(state.activeConversation?.provider)
        ? state.activeConversation?.provider
        : null;
}


export function getRootProviderForActualProvider(provider) {
    if (!provider) {
        return "mlx";
    }

    if (isCloudProvider(provider)) {
        return "cloud";
    }

    return provider;
}


export function getSelectedModel() {
    const provider = getActualProvider();
    const activeCatalog = getProviderCatalog(provider);
    const availableModels = activeCatalog?.models || [];

    if (!availableModels.length) {
        return "";
    }

    const candidateModel = elements.modelSelect.value
        || (
            state.activeConversation?.provider === provider
                ? state.activeConversation?.model
                : state.modelSelections[provider]
        )
        || "";

    if (availableModels.some((model) => model.id === candidateModel)) {
        return candidateModel;
    }

    return availableModels[0]?.id || "";
}


export function isCloudProvider(provider) {
    const providerToCheck = provider || getSelectedProvider();
    return CLOUD_PROVIDERS.has(providerToCheck);
}


export function getProviderDisplayName(provider = getSelectedProvider()) {
    return PROVIDER_LABELS[provider] || provider;
}


export function getRootProviderDisplayName(provider = getSelectedProvider()) {
    return ROOT_PROVIDER_LABELS[provider] || getProviderDisplayName(provider);
}


export function readCloudApiKeyMap(rawValue) {
    if (!rawValue || typeof rawValue !== "string") {
        return {};
    }

    const normalized = rawValue.trim();
    if (!normalized) {
        return {};
    }

    try {
        const parsed = JSON.parse(normalized);
        return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
        return { openai: normalized };
    }
}


export function getCloudApiKey(provider = getSelectedCloudProvider()) {
    const cloudKeys = readCloudApiKeyMap(state.settings.openai_api_key);
    return cloudKeys[provider] || "";
}


export function buildFallbackProviderCatalogs() {
    return [
        { provider: "mlx", available: true, models: [], error: null },
        { provider: "ollama", available: true, models: [], error: null },
        { provider: "openai", available: true, models: [], error: null },
        { provider: "anthropic", available: true, models: [], error: null },
        { provider: "google", available: true, models: [], error: null },
    ];
}
