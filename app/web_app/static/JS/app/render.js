import { elements } from "./dom.js";
import { state } from "./state.js";
import {
    buildFallbackProviderCatalogs,
    createEmptyListItem,
    createMessageMarkup,
    escapeHtml,
    getActiveProject,
    getActualProvider,
    getCloudApiKey,
    getDefaultProfileId,
    getProviderAvailabilityLabel,
    getProviderCatalog,
    getRootProviderDisplayName,
    getRootProviderForActualProvider,
    getProfileNameById,
    getProjectConversations,
    getProviderDisplayName,
    getSelectedModel,
    getSelectedCloudProvider,
    getSelectedProfileId,
    getSelectedProvider,
    isCloudProvider,
    getStandaloneConversations,
    syncComposerAvailability,
} from "./utils.js";


export function renderAll({ onProjectSelect, onConversationSelect, onConversationDelete } = {}) {
    renderProjects(onProjectSelect);
    renderConversations(onConversationSelect, onConversationDelete);
    renderProviderControls();
    renderProjectSpace(onConversationSelect, onConversationDelete);
    renderSettingsSpace();
    renderSettingsProfilesManager();
    renderProfilePicker();
    renderMessages();
    renderConversationHeader();
    populateSettingsForm();
    renderDocumentsFileList();
    syncComposerAvailability();
}


export function renderProjects(onProjectSelect) {
    elements.projectCount.textContent = String(state.projects.length);

    if (!state.projects.length) {
        elements.projectsList.innerHTML = createEmptyListItem("Todavía no hay proyectos.");
        return;
    }

    elements.projectsList.innerHTML = state.projects
        .map((project) => {
            const activeClass = project.id === state.activeProjectId ? " is-active" : "";
            const projectChats = getProjectConversations(project.id).length;
            const description = projectChats
                ? `${projectChats} chat${projectChats === 1 ? "" : "s"} en el proyecto`
                : (project.description || "Sin chats todavía");
            return `
                <button class="list-item${activeClass}" type="button" data-project-id="${project.id}">
                    <div class="list-item__title">${escapeHtml(project.name)}</div>
                    <div class="list-item__meta">${escapeHtml(description)}</div>
                </button>
            `;
        })
        .join("");

    if (!onProjectSelect) {
        return;
    }

    elements.projectsList.querySelectorAll("[data-project-id]").forEach((element) => {
        element.addEventListener("click", () => onProjectSelect(Number(element.dataset.projectId), element));
    });
}


export function renderConversations(onConversationSelect, onConversationDelete) {
    const standaloneConversations = getStandaloneConversations();
    elements.conversationCount.textContent = String(standaloneConversations.length);

    if (!standaloneConversations.length) {
        elements.conversationsList.innerHTML = createEmptyListItem("No hay chats puntuales todavía.");
        return;
    }

    elements.conversationsList.innerHTML = standaloneConversations
        .map((conversation) => {
            const activeClass = conversation.id === state.activeConversationId ? " is-active" : "";
            return `
                <div class="conversation-row${activeClass}" data-conversation-row="${conversation.id}">
                    <button class="list-item conversation-row__main" type="button" data-conversation-id="${conversation.id}">
                        <div class="list-item__title">${escapeHtml(conversation.title || "Nueva conversación")}</div>
                    </button>
                    <button
                        class="icon-button conversation-row__delete"
                        type="button"
                        data-delete-conversation-id="${conversation.id}"
                        aria-label="Borrar chat"
                        title="Borrar chat"
                    >
                        ×
                    </button>
                </div>
            `;
        })
        .join("");

    if (onConversationSelect) {
        elements.conversationsList.querySelectorAll("[data-conversation-id]").forEach((element) => {
            element.addEventListener("click", () => onConversationSelect(Number(element.dataset.conversationId)));
        });
    }

    if (onConversationDelete) {
        elements.conversationsList.querySelectorAll("[data-delete-conversation-id]").forEach((element) => {
            element.addEventListener("click", () => {
                onConversationDelete(Number(element.dataset.deleteConversationId));
            });
        });
    }
}


export function renderProjectSpace(onConversationSelect, onConversationDelete) {
    const activeProject = getActiveProject();
    const hasProjectWorkspace = state.workspaceMode === "project" && !!activeProject;

    elements.projectSpace.hidden = !hasProjectWorkspace;

    if (!activeProject) {
        elements.projectConversationsList.innerHTML = "";
        elements.projectChatCount.textContent = "0 chats";
        return;
    }

    elements.projectSpaceTitle.textContent = activeProject.name;
    elements.projectSpaceDescription.textContent = activeProject.description
        || "Este proyecto tiene su propio espacio, separado de los chats puntuales.";
    elements.projectNameInput.value = activeProject.name || "";
    elements.projectDescriptionInput.value = activeProject.description || "";
    elements.projectSystemPromptInput.value = activeProject.system_prompt || "";

    const projectConversations = getProjectConversations(activeProject.id);
    const totalChats = projectConversations.length;
    elements.projectChatCount.textContent = `${totalChats} chat${totalChats === 1 ? "" : "s"}`;

    if (!projectConversations.length) {
        elements.projectConversationsList.innerHTML = createEmptyListItem(
            "Este proyecto todavía no tiene chats. Usa el botón + para crear el primero."
        );
        return;
    }

    elements.projectConversationsList.innerHTML = projectConversations
        .map((conversation) => {
            const activeClass = conversation.id === state.activeConversationId ? " is-active" : "";
            return `
                <div class="project-chat-card${activeClass}" data-conversation-row="${conversation.id}">
                    <button class="project-chat-card__main" type="button" data-conversation-id="${conversation.id}">
                        <span class="project-chat-card__title">${escapeHtml(conversation.title || "Nuevo chat")}</span>
                    </button>
                    <button
                        class="icon-button conversation-row__delete"
                        type="button"
                        data-delete-conversation-id="${conversation.id}"
                        aria-label="Borrar chat"
                        title="Borrar chat"
                    >
                        ×
                    </button>
                </div>
            `;
        })
        .join("");

    if (onConversationSelect) {
        elements.projectConversationsList.querySelectorAll("[data-conversation-id]").forEach((element) => {
            element.addEventListener("click", () => onConversationSelect(Number(element.dataset.conversationId)));
        });
    }

    if (onConversationDelete) {
        elements.projectConversationsList.querySelectorAll("[data-delete-conversation-id]").forEach((element) => {
            element.addEventListener("click", () => {
                onConversationDelete(Number(element.dataset.deleteConversationId));
            });
        });
    }
}


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
    state.selectedProvider = selectedProvider;

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
    state.selectedCloudProvider = selectedCloudProvider;

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
        state.modelSelections[actualProvider] = selectedModel;
    } else {
        delete state.modelSelections[actualProvider];
    }
}


export function renderMessages() {
    const showConversation = state.workspaceMode === "conversation" && !!state.activeConversation;
    const showEmptyState = state.workspaceMode === "home";

    elements.emptyState.hidden = !showEmptyState;

    if (!showConversation) {
        elements.messagesContainer.hidden = true;
        elements.messagesContainer.innerHTML = "";
        return;
    }

    elements.messagesContainer.hidden = false;
    elements.messagesContainer.innerHTML = state.activeMessages
        .map((message) => createMessageMarkup(message.role, message.content))
        .join("");
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}


export function renderConversationHeader() {
    const activeProject = getActiveProject();

    if (state.workspaceMode === "conversation" && state.activeConversation) {
        const actualProvider = state.activeConversation?.provider || getActualProvider();
        const rootProvider = getRootProviderForActualProvider(actualProvider);
        const provider = rootProvider === "cloud"
            ? `Cloud · ${getProviderDisplayName(actualProvider)}`
            : getRootProviderDisplayName(rootProvider);
        const model = getSelectedModel() || "modelo pendiente";
        const profileName = getProfileNameById(getSelectedProfileId());
        const projectLabel = activeProject ? ` · Proyecto ${activeProject.name}` : "";

        elements.workspaceEyebrow.textContent = activeProject ? "Chat del proyecto" : "Chat";
        elements.conversationTitle.textContent = state.activeConversation.title || "Nueva conversación";
        elements.conversationSubtitle.textContent = `Proveedor ${provider} · Modelo ${model} · Perfil ${profileName}${projectLabel}`;
        elements.backToProjectButton.hidden = !activeProject;
        elements.chatSettingsButton.hidden = false;
        return;
    }

    if (state.workspaceMode === "project" && activeProject) {
        elements.workspaceEyebrow.textContent = "Proyecto";
        elements.conversationTitle.textContent = activeProject.name;
        elements.conversationSubtitle.textContent = "Gestiona aquí el prompt del proyecto y sus chats, sin mezclarlo con los chats puntuales.";
        elements.backToProjectButton.hidden = true;
        elements.chatSettingsButton.hidden = false;
        return;
    }

    if (state.workspaceMode === "settings") {
        elements.workspaceEyebrow.textContent = "Configuración";
        elements.conversationTitle.textContent = "Ajustes generales";
        elements.conversationSubtitle.textContent = "Gestiona aquí el modelo activo, las claves, los perfiles y la sesión de POLAR studio.";
        elements.backToProjectButton.hidden = true;
        elements.chatSettingsButton.hidden = true;
        return;
    }

    if (state.workspaceMode === "home") {
        elements.workspaceEyebrow.textContent = "Chat";
        elements.conversationTitle.textContent = "Nueva conversación";
        elements.conversationSubtitle.textContent = "Abre ajustes generales para configurar el modelo y ajustes del chat para elegir el perfil.";
        elements.backToProjectButton.hidden = true;
        elements.chatSettingsButton.hidden = false;
        return;
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


export function renderSettingsSpace() {
    elements.settingsSpace.hidden = state.workspaceMode !== "settings";
}

export function renderSettingsProfilesManager() {
    if (!elements.settingsProfilesList) {
        return;
    }

    const profiles = state.profiles || [];
    const fallbackProfileId = profiles.some(
        (profile) => profile.id === Number(state.selectedSettingsProfileId)
    )
        ? Number(state.selectedSettingsProfileId)
        : getDefaultProfileId();
    state.selectedSettingsProfileId = fallbackProfileId || null;

    elements.settingsProfilesList.innerHTML = profiles.length
        ? profiles.map((profile) => {
            const isSelected = profile.id === Number(state.selectedSettingsProfileId);
            const defaultBadge = profile.is_default
                ? `<span class="profile-summary-card__badge">Default</span>`
                : "";
            const personality = profile.personality || "Sin personalidad definida";
            const tags = Array.isArray(profile.tags) ? profile.tags.slice(0, 2) : [];
            const tagsMarkup = tags.length
                ? tags.map((tag) => `
                    <span class="profile-summary-card__tag">${escapeHtml(tag)}</span>
                `).join("")
                : `<span class="profile-summary-card__tag profile-summary-card__tag--muted">Sin etiquetas</span>`;

            return `
                <article class="profile-summary-card${isSelected ? " is-selected" : ""}" data-settings-profile-card="${profile.id}">
                    <div class="profile-summary-card__top">
                        <div class="profile-summary-card__heading">
                            <strong class="profile-summary-card__name">${escapeHtml(profile.name)}</strong>
                            <p class="profile-summary-card__personality">${escapeHtml(personality)}</p>
                        </div>
                        <div class="profile-summary-card__status">
                            ${defaultBadge}
                        </div>
                    </div>
                    <div class="profile-summary-card__tags">${tagsMarkup}</div>
                    <div class="profile-summary-card__actions">
                        <button
                            class="ghost-button ghost-button--compact"
                            type="button"
                            data-edit-profile-id="${profile.id}"
                        >
                            Editar
                        </button>
                        <button
                            class="action-button action-button--danger action-button--compact"
                            type="button"
                            data-delete-profile-id="${profile.id}"
                        >
                            Borrar
                        </button>
                    </div>
                </article>
            `;
        }).join("")
        : `<div class="profiles-manager__empty">Todavía no hay perfiles guardados.</div>`;
}


export function renderProfilePicker() {
    if (!elements.profilePicker) {
        return;
    }

    const profiles = state.profiles || [];
    const selectedProfileId = getSelectedProfileId();
    const selectedProfile = profiles.find((profile) => profile.id === Number(selectedProfileId)) || null;

    const optionsMarkup = profiles.length
        ? profiles.map((profile) => {
            const isSelected = profile.id === Number(selectedProfileId);
            const suffix = profile.is_default ? " · default" : "";
            return `
                <button
                    class="profile-picker__option${isSelected ? " is-selected" : ""}"
                    type="button"
                    data-profile-option="${profile.id}"
                >
                    <span class="profile-picker__option-name">${escapeHtml(profile.name)}</span>
                    <span class="profile-picker__option-meta">${escapeHtml((profile.system_prompt || "Sin system prompt") + suffix)}</span>
                </button>
            `;
        }).join("")
        : `<div class="profile-picker__empty">Todavía no hay perfiles. Crea el primero desde aquí.</div>`;

    elements.profilePicker.innerHTML = `
        <div class="selection-field">
            <div class="selection-field__search">
                <button
                    id="profile-picker-trigger"
                    class="profile-picker__trigger"
                    type="button"
                    aria-expanded="false"
                >
                    <span class="profile-picker__trigger-copy">
                        <strong>${escapeHtml(selectedProfile?.name || "Sin perfil activo")}</strong>
                        <span>${escapeHtml(selectedProfile?.system_prompt || "Selecciona un perfil para este chat.")}</span>
                    </span>
                    <span class="profile-picker__trigger-icon">▾</span>
                </button>
                <div id="profile-picker-panel" class="profile-picker__panel" hidden>
                    <label class="field field--stacked profile-picker__search-field">
                        <span>Buscar perfil</span>
                        <input id="profile-picker-search" type="search" placeholder="Busca por nombre o prompt..." autocomplete="off">
                    </label>
                    <div id="profile-picker-results" class="selection-field__results">
                        ${optionsMarkup}
                    </div>
                </div>
            </div>
        </div>
    `;
}


export function renderDocumentsFileList() {
    if (!elements.documentsFileList) {
        return;
    }

    if (!state.stagedDocuments.length) {
        elements.documentsFileList.innerHTML = `<p class="documents-file-list__empty">No hay documentos seleccionados.</p>`;
        return;
    }

    elements.documentsFileList.innerHTML = state.stagedDocuments
        .map((file) => `
            <div class="documents-file">
                <span class="documents-file__name">${escapeHtml(file.name)}</span>
                <span class="documents-file__meta">${escapeHtml(file.sizeLabel)}</span>
            </div>
        `)
        .join("");
}
