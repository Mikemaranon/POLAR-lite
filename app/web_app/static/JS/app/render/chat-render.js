import { syncComposerAvailability } from "../composer-ui.js";
import { elements } from "../dom.js";
import { createMetaChipsMarkup, escapeHtml } from "../html.js";
import { createMessageMarkup, enableMessagesAutoScroll, scrollMessagesToBottom } from "../message-ui.js";
import {
    buildFallbackProviderCatalogs,
    getActualProvider,
    getCloudApiKey,
    getProviderAvailabilityLabel,
    getProviderCatalog,
    getProviderDisplayName,
    getRootProviderDisplayName,
    getSelectedCloudProvider,
    getSelectedModel,
    getSelectedProvider,
    isCloudProvider,
} from "../provider-helpers.js";
import { getActiveProject, getProfileNameById, getSelectedProfileId } from "../selectors.js";
import { rememberSelectedModel, removeSelectedModel, setSelectedCloudProvider, setSelectedProvider } from "../state-actions.js";
import { state } from "../state.js";


export function renderProviderControls() {
    const providerOptions = state.providerCatalogs.length
        ? state.providerCatalogs
        : buildFallbackProviderCatalogs();

    const rootProviders = [
        { provider: "mlx", available: providerOptions.some((catalog) => catalog.provider === "mlx" && catalog.available !== false) },
        { provider: "ollama", available: providerOptions.some((catalog) => catalog.provider === "ollama" && catalog.available !== false) },
        {
            provider: "cloud",
            available: providerOptions.some(
                (catalog) => isCloudProvider(catalog.provider) && catalog.available !== false
            ),
        },
    ];

    const previousProvider = getSelectedProvider();
    const selectedProvider = rootProviders.some((catalog) => catalog.provider === previousProvider)
        ? previousProvider
        : "mlx";
    setSelectedProvider(selectedProvider);

    elements.providerSelect.innerHTML = rootProviders
        .map((catalog) => {
            const selected = catalog.provider === selectedProvider ? " selected" : "";
            const availability = getProviderAvailabilityLabel(catalog);
            return `
                <option value="${catalog.provider}"${selected}>
                    ${escapeHtml(getRootProviderDisplayName(catalog.provider) + availability)}
                </option>
            `;
        })
        .join("");

    const cloudProviderOptions = providerOptions.filter((catalog) => isCloudProvider(catalog.provider));
    const selectedCloudProvider = cloudProviderOptions.some(
        (catalog) => catalog.provider === getSelectedCloudProvider()
    )
        ? getSelectedCloudProvider()
        : (cloudProviderOptions[0]?.provider || "openai");
    setSelectedCloudProvider(selectedCloudProvider);

    elements.cloudProviderSelect.innerHTML = cloudProviderOptions
        .map((catalog) => {
            const selected = catalog.provider === selectedCloudProvider ? " selected" : "";
            const availability = getProviderAvailabilityLabel(catalog);
            return `
                <option value="${catalog.provider}"${selected}>
                    ${escapeHtml(getProviderDisplayName(catalog.provider) + availability)}
                </option>
            `;
        })
        .join("");

    const actualProvider = getActualProvider();
    const activeCatalog = getProviderCatalog(actualProvider)
        || providerOptions.find((catalog) => catalog.provider === actualProvider)
        || null;
    const models = activeCatalog?.models || [];
    const configuredModel = state.activeConversation?.provider === actualProvider
        ? state.activeConversation.model
        : state.modelSelections[actualProvider];
    const selectedModel = models.some((model) => model.id === configuredModel)
        ? configuredModel
        : (models[0]?.id || "");

    if (!models.length) {
        const emptyLabel = activeCatalog?.available === false
            ? "Proveedor no disponible"
            : "Sin catálogo disponible";
        elements.modelSelect.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
    } else {
        elements.modelSelect.innerHTML = models
            .map((model) => {
                const displayName = model.display_name || model.id;
                const selected = selectedModel === model.id ? " selected" : "";
                return `<option value="${escapeHtml(model.id)}"${selected}>${escapeHtml(displayName)}</option>`;
            })
            .join("");
    }

    elements.modelSelect.disabled = !models.length;
    if (selectedModel) {
        elements.modelSelect.value = selectedModel;
        rememberSelectedModel(actualProvider, selectedModel);
    } else {
        removeSelectedModel(actualProvider);
    }
}


export function renderMessages({ preserveViewport = false } = {}) {
    const showConversation = state.workspaceMode === "conversation" && !!state.activeConversation;
    const showEmptyState = state.workspaceMode === "home";

    elements.emptyState.hidden = !showEmptyState;

    if (!showConversation) {
        elements.messagesContainer.hidden = true;
        elements.messagesContainer.innerHTML = "";
        enableMessagesAutoScroll();
        return;
    }

    elements.messagesContainer.hidden = false;
    elements.messagesContainer.innerHTML = state.activeMessages
        .map((message) => createMessageMarkup(message.role, message.content))
        .join("");

    if (preserveViewport) {
        return;
    }

    enableMessagesAutoScroll();
    scrollMessagesToBottom();
}


export function renderConversationHeader() {
    const activeProject = getActiveProject();

    if (state.workspaceMode === "conversation" && state.activeConversation) {
        const actualProvider = state.activeConversation?.provider || getActualProvider();
        const provider = getProviderDisplayName(actualProvider);
        const model = state.activeConversation?.model || getSelectedModel() || "modelo pendiente";
        const profileName = getProfileNameById(state.activeConversation?.profile_id || getSelectedProfileId());

        elements.workspaceEyebrow.textContent = activeProject ? "Chat del proyecto" : "Chat";
        elements.conversationTitle.textContent = state.activeConversation.title || "Nueva conversación";
        elements.conversationMeta.innerHTML = createMetaChipsMarkup([
            { group: "provider", label: "Proveedor", value: provider },
            { group: "model", label: "Modelo", value: model },
            { group: "profile", label: "Perfil", value: profileName },
        ]);
        elements.conversationMeta.hidden = false;
        elements.conversationSubtitle.hidden = true;
        elements.backToProjectButton.hidden = !activeProject;
        elements.chatSettingsButton.hidden = false;
        return;
    }

    if (state.workspaceMode === "project" && activeProject) {
        elements.workspaceEyebrow.textContent = "Proyecto";
        elements.conversationTitle.textContent = activeProject.name;
        elements.conversationSubtitle.textContent = "Gestiona aquí el prompt del proyecto y sus chats, sin mezclarlo con los chats puntuales.";
        elements.conversationMeta.innerHTML = "";
        elements.conversationMeta.hidden = true;
        elements.conversationSubtitle.hidden = false;
        elements.backToProjectButton.hidden = true;
        elements.chatSettingsButton.hidden = false;
        return;
    }

    if (state.workspaceMode === "settings") {
        elements.workspaceEyebrow.textContent = "Configuración";
        elements.conversationTitle.textContent = "Ajustes generales";
        elements.conversationSubtitle.textContent = "Gestiona aquí el modelo activo, las claves, los perfiles y la sesión de POLAR lite.";
        elements.conversationMeta.innerHTML = "";
        elements.conversationMeta.hidden = true;
        elements.conversationSubtitle.hidden = false;
        elements.backToProjectButton.hidden = true;
        elements.chatSettingsButton.hidden = true;
        return;
    }

    if (state.workspaceMode === "home") {
        elements.workspaceEyebrow.textContent = "Chat";
        elements.conversationTitle.textContent = "Nueva conversación";
        elements.conversationSubtitle.textContent = "Abre ajustes generales para configurar el modelo y ajustes del chat para elegir el perfil.";
        elements.conversationMeta.innerHTML = "";
        elements.conversationMeta.hidden = true;
        elements.conversationSubtitle.hidden = false;
        elements.backToProjectButton.hidden = true;
        elements.chatSettingsButton.hidden = false;
    }
}


export function populateSettingsForm() {
    const cloudProvider = getSelectedCloudProvider();
    const providerLabel = getProviderDisplayName(cloudProvider);

    elements.cloudApiKeyLabel.textContent = `${providerLabel} API key`;
    elements.openaiApiKeyInput.placeholder = `Clave para ${providerLabel}`;
    elements.openaiApiKeyInput.disabled = false;
    elements.openaiApiKeyInput.value = getCloudApiKey(cloudProvider);
}


export function renderChatSurface() {
    renderProviderControls();
    renderMessages();
    renderConversationHeader();
    populateSettingsForm();
    syncComposerAvailability();
}
