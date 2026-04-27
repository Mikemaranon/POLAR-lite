import { elements } from "./dom.js";
import { renderMarkdown } from "./markdown.js";
import { state } from "./state.js";

const CLOUD_PROVIDERS = new Set(["openai", "anthropic", "google"]);
export const MAX_PROFILE_TAGS = 10;
export const PROFILE_SETTINGS_PREVIEW_TAGS = 4;
const ROOT_PROVIDER_LABELS = {
    cloud: "Cloud",
    mlx: "MLX",
    ollama: "Ollama",
};
const MESSAGES_AUTO_SCROLL_THRESHOLD = 24;
const PROVIDER_LABELS = {
    anthropic: "Anthropic",
    cloud: "Cloud",
    google: "Google",
    mlx: "MLX",
    ollama: "Ollama",
    openai: "OpenAI",
};


export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}


export function createEmptyListItem(message) {
    return `<div class="list-item list-item--empty">${escapeHtml(message)}</div>`;
}


export function createMetaChipsMarkup(chips) {
    return chips.map((chip) => `
        <span class="selection-chip selection-chip--static" data-group="${escapeHtml(chip.group)}">
            <span class="selection-chip__group">${escapeHtml(chip.label)}</span>
            <span class="selection-chip__value">${escapeHtml(chip.value)}</span>
        </span>
    `).join("");
}


export function createMessageMarkup(role, content) {
    const isUser = role === "user";
    const roleLabel = isUser ? "Tú" : "Asistente";
    const avatar = isUser ? "YOU" : "AI";
    const contentClass = isUser ? "message__content--plain" : "message__content--markdown";
    const renderedContent = isUser
        ? escapeHtml(content || "")
        : renderMarkdown(content || "");

    return `
        <article class="message message--${isUser ? "user" : "assistant"}">
            <div class="message__avatar">${avatar}</div>
            <div class="message__card">
                <div class="message__meta">${roleLabel}</div>
                <div class="message__content ${contentClass}" data-message-content="true">${renderedContent}</div>
            </div>
        </article>
    `;
}


export function isMessagesContainerNearBottom() {
    const container = elements.messagesContainer;

    if (!container || container.hidden) {
        return true;
    }

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= MESSAGES_AUTO_SCROLL_THRESHOLD;
}


export function scrollMessagesToBottom() {
    if (!elements.messagesContainer) {
        return;
    }

    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}


export function enableMessagesAutoScroll() {
    state.messagesAutoScrollEnabled = true;
}


export function disableMessagesAutoScroll() {
    state.messagesAutoScrollEnabled = false;
}


export function syncMessagesAutoScrollState() {
    state.messagesAutoScrollEnabled = isMessagesContainerNearBottom();
}


export function keepMessagesPinnedToBottomIfNeeded() {
    if (!state.messagesAutoScrollEnabled) {
        return;
    }

    scrollMessagesToBottom();
}


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


export function getDefaultProfileId() {
    return state.profiles.find((profile) => profile.is_default)?.id || state.profiles[0]?.id || null;
}


export function getProfileNameById(profileId) {
    if (!profileId) {
        return "sin perfil";
    }

    return state.profiles.find((profile) => profile.id === Number(profileId))?.name || "sin perfil";
}


export function getActiveProject() {
    return state.projects.find((project) => project.id === state.activeProjectId) || null;
}


export function getProjectConversations(projectId = state.activeProjectId) {
    if (!projectId) {
        return [];
    }

    return state.conversations.filter((conversation) => conversation.project_id === projectId);
}


export function getStandaloneConversations() {
    return state.conversations.filter((conversation) => !conversation.project_id);
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


export function getSelectedProfileId() {
    if (state.activeConversation?.profile_id) {
        return Number(state.activeConversation.profile_id);
    }

    if (state.pendingProfileId) {
        return Number(state.pendingProfileId);
    }

    return getDefaultProfileId();
}


export function buildConversationTitle() {
    const project = state.projects.find((item) => item.id === state.activeProjectId);
    if (project) {
        return `${project.name} · chat`;
    }
    return "Nueva conversación";
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


export function autoResizeComposer() {
    elements.composerInput.style.height = "auto";
    elements.composerInput.style.height = `${Math.min(elements.composerInput.scrollHeight, 220)}px`;
}


export function showStatus(message, isError = false) {
    elements.statusBanner.hidden = false;
    elements.statusBanner.textContent = message;
    elements.statusBanner.classList.toggle("is-error", isError);

    window.clearTimeout(showStatus.timeoutId);
    showStatus.timeoutId = window.setTimeout(() => {
        elements.statusBanner.hidden = true;
    }, 4200);
}


export function setLoading(isLoading) {
    state.loading = isLoading;
    elements.newChatButton.disabled = isLoading;
    elements.newProjectButton.disabled = isLoading;
    if (elements.newProjectChatButton) {
        elements.newProjectChatButton.disabled = isLoading;
    }
    if (elements.addDocumentsButton) {
        elements.addDocumentsButton.disabled = isLoading;
    }
    if (elements.customizeProjectButton) {
        elements.customizeProjectButton.disabled = isLoading;
    }
    syncComposerAvailability();
}


function openModal(modal) {
    modal.hidden = false;
    modal.dataset.state = "closed";
    document.body.classList.add("is-modal-open", "modal-open");
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            modal.dataset.state = "open";
        });
    });
}


function closeModal(modal) {
    if (modal.hidden || modal.dataset.state === "closing") {
        return;
    }

    modal.dataset.state = "closing";

    window.setTimeout(() => {
        modal.hidden = true;
        modal.dataset.state = "closed";

        const anyModalOpen = [...document.querySelectorAll(".modal")].some((item) => !item.hidden);

        if (!anyModalOpen) {
            document.body.classList.remove("is-modal-open", "modal-open");
        }
    }, 240);
}


export function openChatSettingsModal() {
    openModal(elements.chatSettingsModal);
}


export function closeChatSettingsModal() {
    closeModal(elements.chatSettingsModal);
}


export function openProfileModal() {
    openModal(elements.profileModal);
}


export function closeProfileModal() {
    closeModal(elements.profileModal);
}


export function openProjectCustomizeModal() {
    openModal(elements.projectCustomizeModal);
}


export function closeProjectCustomizeModal() {
    closeModal(elements.projectCustomizeModal);
}


export function openDocumentsModal() {
    openModal(elements.documentsModal);
}


export function closeDocumentsModal() {
    closeModal(elements.documentsModal);
}


export function appendTypingMessage() {
    elements.emptyState.hidden = true;
    elements.messagesContainer.hidden = false;
    elements.messagesContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="message message--assistant" data-typing-message="true">
                <div class="message__avatar">AI</div>
                <div class="message__card">
                    <div class="message__meta">Asistente</div>
                    <div class="typing-indicator"><span></span><span></span><span></span></div>
                </div>
            </div>
        `
    );
    keepMessagesPinnedToBottomIfNeeded();
}


export function removeTypingMessage() {
    document.querySelector("[data-typing-message='true']")?.remove();
}


export function appendStreamingAssistantMessage() {
    elements.emptyState.hidden = true;
    elements.messagesContainer.hidden = false;
    elements.messagesContainer.insertAdjacentHTML(
        "beforeend",
        `
            <article class="message message--assistant" data-streaming-message="true">
                <div class="message__avatar">AI</div>
                <div class="message__card">
                    <div class="message__meta">Asistente</div>
                    <div class="message__content message__content--markdown" data-message-content="true"></div>
                </div>
            </article>
        `
    );
    keepMessagesPinnedToBottomIfNeeded();
}


export function updateStreamingAssistantMessage(content) {
    const contentNode = document.querySelector(
        "[data-streaming-message='true'] [data-message-content='true']"
    );

    if (!contentNode) {
        return;
    }

    contentNode.innerHTML = renderMarkdown(content || "");
    keepMessagesPinnedToBottomIfNeeded();
}


export function finalizeStreamingAssistantMessage(content) {
    const streamingNode = document.querySelector("[data-streaming-message='true']");
    if (!streamingNode) {
        return;
    }

    updateStreamingAssistantMessage(content);
    streamingNode.removeAttribute("data-streaming-message");
}


export function removeStreamingAssistantMessage() {
    document.querySelector("[data-streaming-message='true']")?.remove();
}


export function syncComposerAvailability() {
    const isProjectWorkspace = state.workspaceMode === "project";
    const isSettingsWorkspace = state.workspaceMode === "settings";
    const activeCatalog = getProviderCatalog();
    const providerReady = activeCatalog ? activeCatalog.available !== false : true;
    const shouldDisableComposer = state.loading || isProjectWorkspace || isSettingsWorkspace || !providerReady;

    elements.composerShell.hidden = isProjectWorkspace || isSettingsWorkspace;
    elements.sendButton.disabled = shouldDisableComposer;
    elements.composerInput.disabled = shouldDisableComposer;

    if (isProjectWorkspace) {
        elements.composerInput.placeholder = "Abre o crea un chat dentro del proyecto para escribir.";
        elements.composerHint.textContent = "Los proyectos gestionan contexto; el texto se escribe dentro de un chat del proyecto.";
    } else if (isSettingsWorkspace) {
        elements.composerInput.placeholder = "Vuelve a un chat para escribir.";
        elements.composerHint.textContent = "Los ajustes generales se gestionan desde esta vista.";
    } else if (!providerReady) {
        elements.composerInput.placeholder = "Este proveedor no está listo para responder todavía.";
        elements.composerHint.textContent = activeCatalog?.error?.message
            || "Completa la configuración del proveedor antes de iniciar el chat.";
    } else if (!getSelectedModel()) {
        elements.composerInput.placeholder = "Selecciona un proveedor y un modelo disponible antes de escribir.";
        elements.composerHint.textContent = "Solo se puede chatear con modelos detectados por el proveedor activo.";
    } else {
        elements.composerInput.placeholder = "Pregunta cualquier cosa...";
        elements.composerHint.textContent = "`Shift + Enter` para salto de línea";
    }
}
