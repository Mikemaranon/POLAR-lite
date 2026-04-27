import { createConversation, createProfile, createProject, deleteConversation, deleteProfile, deleteProject, persistSetting, sendChat, updateConversation, updateProfile, updateProject } from "./api.js";
import { confirmAction, requestProjectDetails } from "./dialogs.js";
import { elements } from "./dom.js";
import { populateSettingsForm, renderAll, renderConversationHeader, renderConversations, renderDocumentsFileList, renderMessages, renderProfilePicker, renderProviderControls, renderSettingsProfilesManager } from "./render.js";
import { loadConversationDetail, loadConversations, loadModels, loadProfiles, loadProjects, loadSettings } from "./store.js";
import { state } from "./state.js";
import {
    appendTypingMessage,
    autoResizeComposer,
    buildConversationTitle,
    closeChatSettingsModal,
    closeDocumentsModal,
    closeProfileModal,
    closeProjectCustomizeModal,
    getActualProvider,
    getActiveProject,
    getDefaultProfileId,
    getSelectedModel,
    getSelectedCloudProvider,
    getSelectedProfileId,
    getSelectedProvider,
    isCloudProvider,
    openChatSettingsModal,
    openDocumentsModal,
    openProfileModal,
    openProjectCustomizeModal,
    readCloudApiKeyMap,
    removeTypingMessage,
    setLoading,
    showStatus,
    syncComposerAvailability,
} from "./utils.js";
import { delete_token, getToken, loadPage, send_API_request } from "../SERVER_CONN/token-handler.js";


export async function bootApp() {
    await Promise.all([
        loadSettings(),
        loadProfiles(),
        loadProjects(),
        loadModels(),
        loadConversations(),
    ]);

    state.workspaceMode = "home";

    renderAll({
        onProjectSelect: handleProjectSelect,
        onConversationSelect: handleConversationSelect,
        onConversationDelete: handleConversationDelete,
    });
}


export function bindUI() {
    elements.composerForm.addEventListener("submit", handleComposerSubmit);
    elements.composerInput.addEventListener("keydown", handleComposerKeyDown);
    elements.composerInput.addEventListener("input", autoResizeComposer);
    elements.providerSelect.addEventListener("change", handleProviderChange);
    elements.cloudProviderSelect.addEventListener("change", handleCloudProviderChange);
    elements.modelSelect.addEventListener("change", handleModelChange);
    elements.newChatButton.addEventListener("click", createConversationFromUI);
    elements.newProjectButton.addEventListener("click", handleNewProject);
    elements.newProjectChatButton?.addEventListener("click", handleNewProjectChat);
    elements.addDocumentsButton?.addEventListener("click", openDocumentsModal);
    elements.customizeProjectButton?.addEventListener("click", openProjectCustomizeModal);
    elements.workspaceSettingsButton?.addEventListener("click", handleWorkspaceSettingsOpen);
    elements.chatSettingsButton?.addEventListener("click", openChatSettingsModal);
    elements.backToProjectButton?.addEventListener("click", handleBackToProject);
    elements.closeSettingsButton.addEventListener("click", closeChatSettingsModal);
    elements.closeProfileButton?.addEventListener("click", closeProfileModal);
    elements.closeProjectCustomizeButton?.addEventListener("click", closeProjectCustomizeModal);
    elements.closeDocumentsButton?.addEventListener("click", closeDocumentsModal);
    elements.settingsForm.addEventListener("submit", handleSettingsSubmit);
    elements.profileForm.addEventListener("submit", handleProfileSubmit);
    elements.projectCustomizeForm?.addEventListener("submit", handleProjectCustomizeSubmit);
    elements.deleteProjectButton?.addEventListener("click", handleProjectDelete);
    elements.newProfileButton?.addEventListener("click", () => openCreateProfileModal("chat-settings"));
    elements.settingsNewProfileButton?.addEventListener("click", () => openCreateProfileModal("settings"));
    elements.profileCancelButton?.addEventListener("click", closeProfileModal);
    elements.documentsInput?.addEventListener("change", handleDocumentsSelected);
    elements.documentsDropzone?.addEventListener("dragover", handleDocumentsDragOver);
    elements.documentsDropzone?.addEventListener("dragleave", handleDocumentsDragLeave);
    elements.documentsDropzone?.addEventListener("drop", handleDocumentsDrop);
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.chatSettingsModal.addEventListener("click", (event) => {
        if (event.target.dataset.closeModal === "true") {
            closeChatSettingsModal();
        }
    });
    elements.profileModal?.addEventListener("click", (event) => {
        if (event.target.dataset.closeProfileModal === "true") {
            closeProfileModal();
        }
    });
    elements.projectCustomizeModal?.addEventListener("click", (event) => {
        if (event.target.dataset.closeProjectModal === "true") {
            closeProjectCustomizeModal();
        }
    });
    elements.documentsModal?.addEventListener("click", (event) => {
        if (event.target.dataset.closeDocumentsModal === "true") {
            closeDocumentsModal();
        }
    });
    document.addEventListener("keydown", handleDocumentKeyDown);
    document.querySelectorAll("[data-prompt]").forEach((element) => {
        element.addEventListener("click", () => {
            elements.composerInput.value = element.dataset.prompt || "";
            autoResizeComposer();
            elements.composerInput.focus();
        });
    });
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("input", handleDocumentInput);
}


export function ensureAuthenticated() {
    if (!getToken()) {
        window.location.href = "/login";
        return false;
    }

    return true;
}


async function handleProjectSelect(projectId, element) {
    state.workspaceMode = "project";
    state.activeProjectId = projectId;
    state.activeConversationId = null;
    state.activeConversation = null;
    state.activeMessages = [];
    renderAll({
        onProjectSelect: handleProjectSelect,
        onConversationSelect: handleConversationSelect,
        onConversationDelete: handleConversationDelete,
    });
}


async function handleConversationSelect(conversationId) {
    await loadConversationDetail(conversationId);
    renderAll({
        onProjectSelect: handleProjectSelect,
        onConversationSelect: handleConversationSelect,
        onConversationDelete: handleConversationDelete,
    });
}


async function handleComposerSubmit(event) {
    event.preventDefault();

    if (state.loading) {
        return;
    }

    const content = elements.composerInput.value.trim();
    if (!content) {
        return;
    }
    if (!getSelectedModel()) {
        showStatus("Selecciona un modelo disponible antes de enviar el mensaje.", true);
        return;
    }

    try {
        setLoading(true);

        const conversationId = await ensureActiveConversation();
        const requestMessages = [...state.activeMessages, { role: "user", content }];

        state.activeMessages = requestMessages;
        renderMessages();
        elements.composerInput.value = "";
        autoResizeComposer();
        appendTypingMessage();

        const payload = await sendChat({
            conversation_id: conversationId,
            messages: requestMessages,
            provider: getActualProvider(),
            model: getSelectedModel(),
            profile_id: getSelectedProfileId(),
        });

        removeTypingMessage();
        state.activeMessages.push(payload.response.message);
        state.activeConversation = {
            ...(state.activeConversation || {}),
            id: conversationId,
            provider: getActualProvider(),
            model: getSelectedModel(),
            profile_id: getSelectedProfileId(),
        };
        await updateConversation({
            id: conversationId,
            provider: getActualProvider(),
            model: getSelectedModel(),
            profile_id: getSelectedProfileId(),
        });
        await loadConversations();
        renderConversations(handleConversationSelect, handleConversationDelete);
        renderMessages();
        renderConversationHeader();
    } catch (error) {
        removeTypingMessage();
        renderMessages();
        showStatus(error.message || "No se pudo enviar el mensaje.", true);
    } finally {
        setLoading(false);
    }
}


function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        elements.composerForm.requestSubmit();
    }
}


function handleDocumentKeyDown(event) {
    if (event.key !== "Escape") {
        return;
    }

    if (!elements.chatSettingsModal.hidden) {
        closeChatSettingsModal();
    }
    if (!elements.profileModal.hidden) {
        closeProfileModal();
    }
    if (!elements.projectCustomizeModal.hidden) {
        closeProjectCustomizeModal();
    }
    if (!elements.documentsModal.hidden) {
        closeDocumentsModal();
    }
}


function handleProviderChange() {
    state.selectedProvider = elements.providerSelect.value;
    renderProviderControls();
    populateSettingsForm();
    renderConversationHeader();
    syncComposerAvailability();

    const activeCatalog = state.providerCatalogs.find(
        (catalog) => catalog.provider === getActualProvider()
    );

    if (activeCatalog?.error?.message) {
        showStatus(activeCatalog.error.message, true);
    }
}


function handleCloudProviderChange() {
    state.selectedCloudProvider = elements.cloudProviderSelect.value;
    renderProviderControls();
    populateSettingsForm();
    renderConversationHeader();
    syncComposerAvailability();

    const activeCatalog = state.providerCatalogs.find(
        (catalog) => catalog.provider === getSelectedCloudProvider()
    );

    if (activeCatalog?.error?.message) {
        showStatus(activeCatalog.error.message, true);
    }
}


function handleModelChange() {
    const selectedModel = elements.modelSelect.value;
    if (selectedModel) {
        state.modelSelections[getActualProvider()] = selectedModel;
    }
    renderConversationHeader();
    syncComposerAvailability();
}


async function createConversationFromUI() {
    if (!getSelectedModel()) {
        showStatus("Selecciona un modelo disponible antes de crear el chat.", true);
        return;
    }

    try {
        state.workspaceMode = "conversation";
        const conversationId = await createConversationRecord({
            title: "Nueva conversación",
            project_id: null,
            profile_id: getSelectedProfileId(),
            provider: getActualProvider(),
            model: getSelectedModel(),
        });

        await handleConversationSelect(conversationId);
    } catch (error) {
        showStatus(error.message || "No se pudo crear la conversación.", true);
    }
}


async function createConversationRecord(payload) {
    const data = await createConversation(payload);
    await loadConversations();
    renderAll({
        onProjectSelect: handleProjectSelect,
        onConversationSelect: handleConversationSelect,
        onConversationDelete: handleConversationDelete,
    });
    return data.conversation.id;
}


async function ensureActiveConversation() {
    if (state.activeConversationId) {
        return state.activeConversationId;
    }

    if (!getSelectedModel()) {
        throw new Error("Selecciona un modelo disponible antes de empezar a chatear.");
    }

    state.workspaceMode = "conversation";
    const conversationId = await createConversationRecord({
        title: buildConversationTitle(),
        project_id: state.activeProjectId,
        profile_id: getSelectedProfileId(),
        provider: getActualProvider(),
        model: getSelectedModel(),
    });
    await handleConversationSelect(conversationId);
    return conversationId;
}


async function handleNewProject() {
    const projectDetails = await requestProjectDetails();
    if (!projectDetails) {
        return;
    }

    try {
        const payload = await createProject(projectDetails);
        await loadProjects();
        state.workspaceMode = "project";
        state.activeProjectId = payload.project.id;
        state.activeConversationId = null;
        state.activeConversation = null;
        state.activeMessages = [];
        renderAll({
            onProjectSelect: handleProjectSelect,
            onConversationSelect: handleConversationSelect,
            onConversationDelete: handleConversationDelete,
        });
    } catch (error) {
        showStatus(error.message || "No se pudo crear el proyecto.", true);
    }
}


async function handleNewProjectChat() {
    const activeProject = getActiveProject();
    if (!activeProject) {
        showStatus("Selecciona primero un proyecto.", true);
        return;
    }
    if (!getSelectedModel()) {
        showStatus("Selecciona un modelo disponible antes de crear el chat del proyecto.", true);
        return;
    }

    try {
        await createConversation({
            title: `${activeProject.name} · chat`,
            project_id: activeProject.id,
            profile_id: getSelectedProfileId(),
            provider: getActualProvider(),
            model: getSelectedModel(),
        });

        await loadConversations();
        state.workspaceMode = "project";
        state.activeProjectId = activeProject.id;
        state.activeConversationId = null;
        state.activeConversation = null;
        state.activeMessages = [];
        renderAll({
            onProjectSelect: handleProjectSelect,
            onConversationSelect: handleConversationSelect,
            onConversationDelete: handleConversationDelete,
        });
    } catch (error) {
        showStatus(error.message || "No se pudo crear el chat del proyecto.", true);
    }
}


function handleWorkspaceSettingsOpen() {
    state.workspaceMode = "settings";
    renderAll({
        onProjectSelect: handleProjectSelect,
        onConversationSelect: handleConversationSelect,
        onConversationDelete: handleConversationDelete,
    });
}


function handleBackToProject() {
    if (!state.activeProjectId) {
        return;
    }

    state.workspaceMode = "project";
    state.activeConversationId = null;
    state.activeConversation = null;
    state.activeMessages = [];
    renderAll({
        onProjectSelect: handleProjectSelect,
        onConversationSelect: handleConversationSelect,
        onConversationDelete: handleConversationDelete,
    });
}


async function handleSettingsSubmit(event) {
    event.preventDefault();

    const provider = getSelectedCloudProvider();

    try {
        const existingCloudKeys = readCloudApiKeyMap(state.settings.openai_api_key);

        const apiKey = elements.openaiApiKeyInput.value.trim();
        if (apiKey) {
            existingCloudKeys[provider] = apiKey;
        } else {
            delete existingCloudKeys[provider];
        }

        await persistSetting("openai_api_key", JSON.stringify(existingCloudKeys));

        await loadSettings();
        await loadModels();
        renderProviderControls();
        populateSettingsForm();
        syncComposerAvailability();
    } catch (error) {
        showStatus(error.message || "No se pudieron guardar los ajustes.", true);
    }
}


async function handleProfileSubmit(event) {
    event.preventDefault();

    const profilePayload = readProfileFormValues({
        idInput: elements.profileIdInput,
        nameInput: elements.profileNameInput,
        personalityInput: elements.profilePersonalityInput,
        tagsInput: elements.profileTagsInput,
        systemPromptInput: elements.profileSystemPromptInput,
        temperatureInput: elements.profileTemperatureInput,
        topPInput: elements.profileTopPInput,
        maxTokensInput: elements.profileMaxTokensInput,
        defaultInput: elements.profileDefaultInput,
    });

    if (!profilePayload.name) {
        showStatus("El perfil necesita un nombre.", true);
        return;
    }
    if (profilePayload.tags.length > 2) {
        showStatus("Las etiquetas admiten un máximo de 2 elementos.", true);
        return;
    }

    try {
        const isEditing = Boolean(profilePayload.id);
        const payload = isEditing
            ? await updateProfile(profilePayload)
            : await createProfile(profilePayload);

        await loadProfiles();
        state.selectedSettingsProfileId = payload.profile.id;

        if (!isEditing && state.profileModalContext === "chat-settings") {
            if (state.activeConversationId && state.activeConversation) {
                await updateConversation({
                    id: state.activeConversationId,
                    profile_id: payload.profile.id,
                });
                state.activeConversation.profile_id = payload.profile.id;
            } else {
                state.pendingProfileId = payload.profile.id;
            }
        }

        state.profileModalMode = "edit";
        state.profileModalProfileId = payload.profile.id;
        populateProfileModal(payload.profile);
        closeProfileModal();

        renderSettingsProfilesManager();
        renderProfilePicker();
        renderConversationHeader();
        showStatus(isEditing ? "Perfil actualizado." : "Perfil creado.");
    } catch (error) {
        showStatus(error.message || "No se pudo guardar el perfil.", true);
    }
}

async function handleProjectCustomizeSubmit(event) {
    event.preventDefault();

    const activeProject = getActiveProject();
    if (!activeProject) {
        showStatus("No hay un proyecto activo para personalizar.", true);
        return;
    }

    const name = elements.projectNameInput.value.trim();
    if (!name) {
        showStatus("El proyecto necesita un nombre.", true);
        return;
    }

    try {
        await updateProject({
            id: activeProject.id,
            name,
            description: elements.projectDescriptionInput.value.trim(),
            system_prompt: elements.projectSystemPromptInput.value.trim(),
        });

        await loadProjects();
        renderAll({
            onProjectSelect: handleProjectSelect,
            onConversationSelect: handleConversationSelect,
            onConversationDelete: handleConversationDelete,
        });
        closeProjectCustomizeModal();
    } catch (error) {
        showStatus(error.message || "No se pudo guardar la personalización.", true);
    }
}


async function handleConversationDelete(conversationId) {
    const conversation = state.conversations.find((item) => item.id === conversationId);
    const label = conversation?.title || "este chat";
    const confirmed = await confirmAction({
        title: `Borrar "${label}"`,
        message: "Esta acción elimina el chat y sus mensajes. No se puede deshacer.",
        confirmLabel: "Borrar chat",
        eyebrow: "Chat",
    });

    if (!confirmed) {
        return;
    }

    try {
        await deleteConversation(conversationId);

        const deletedActiveConversation = state.activeConversationId === conversationId;
        if (deletedActiveConversation) {
            state.activeConversationId = null;
            state.activeConversation = null;
            state.activeMessages = [];
            state.workspaceMode = state.activeProjectId ? "project" : "home";
        }

        await loadConversations();
        renderAll({
            onProjectSelect: handleProjectSelect,
            onConversationSelect: handleConversationSelect,
            onConversationDelete: handleConversationDelete,
        });
    } catch (error) {
        showStatus(error.message || "No se pudo borrar el chat.", true);
    }
}


async function handleProjectDelete() {
    const activeProject = getActiveProject();
    if (!activeProject) {
        showStatus("No hay un proyecto activo para borrar.", true);
        return;
    }

    const confirmed = await confirmAction({
        title: `Borrar "${activeProject.name}"`,
        message: "El proyecto se elimina de la lista. Sus chats se conservarán como chats puntuales.",
        confirmLabel: "Borrar proyecto",
        eyebrow: "Proyecto",
    });

    if (!confirmed) {
        return;
    }

    try {
        await deleteProject(activeProject.id);
        state.workspaceMode = "home";
        state.activeProjectId = null;
        state.activeConversationId = null;
        state.activeConversation = null;
        state.activeMessages = [];

        await Promise.all([loadProjects(), loadConversations()]);
        renderAll({
            onProjectSelect: handleProjectSelect,
            onConversationSelect: handleConversationSelect,
            onConversationDelete: handleConversationDelete,
        });
        closeProjectCustomizeModal();
    } catch (error) {
        showStatus(error.message || "No se pudo borrar el proyecto.", true);
    }
}


function handleDocumentsSelected(event) {
    stageDocuments(event.target.files);
}


function handleDocumentsDragOver(event) {
    event.preventDefault();
    elements.documentsDropzone.classList.add("is-dragging");
}


function handleDocumentsDragLeave() {
    elements.documentsDropzone.classList.remove("is-dragging");
}


function handleDocumentsDrop(event) {
    event.preventDefault();
    elements.documentsDropzone.classList.remove("is-dragging");
    stageDocuments(event.dataTransfer.files);
}


function stageDocuments(fileList) {
    const files = Array.from(fileList || []);
    state.stagedDocuments = files.map((file) => ({
        name: file.name,
        sizeLabel: formatFileSize(file.size),
    }));
    renderDocumentsFileList();
}


function formatFileSize(size) {
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}


function handleDocumentClick(event) {
    const trigger = event.target.closest("#profile-picker-trigger");
    if (trigger) {
        toggleProfilePicker();
        return;
    }

    const option = event.target.closest("[data-profile-option]");
    if (option) {
        handleProfileOptionSelect(Number(option.dataset.profileOption));
        return;
    }

    const settingsProfileOption = event.target.closest("[data-settings-profile-id]");
    if (settingsProfileOption) {
        handleSettingsProfileEdit(Number(settingsProfileOption.dataset.settingsProfileId));
        return;
    }

    const editProfileButton = event.target.closest("[data-edit-profile-id]");
    if (editProfileButton) {
        handleSettingsProfileEdit(Number(editProfileButton.dataset.editProfileId));
        return;
    }

    const deleteProfileButton = event.target.closest("[data-delete-profile-id]");
    if (deleteProfileButton) {
        handleSettingsProfileDelete(Number(deleteProfileButton.dataset.deleteProfileId));
        return;
    }

    if (!event.target.closest("#profile-picker")) {
        closeProfilePicker();
    }
}


function handleDocumentInput(event) {
    if (event.target.id !== "profile-picker-search") {
        return;
    }

    filterProfileOptions(event.target.value);
}


function toggleProfilePicker() {
    const panel = document.getElementById("profile-picker-panel");
    const trigger = document.getElementById("profile-picker-trigger");
    const search = document.getElementById("profile-picker-search");

    if (!panel || !trigger) {
        return;
    }

    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    trigger.setAttribute("aria-expanded", String(nextOpen));

    if (nextOpen && search) {
        search.value = "";
        filterProfileOptions("");
        window.setTimeout(() => search.focus({ preventScroll: true }), 0);
    }
}


function closeProfilePicker() {
    const panel = document.getElementById("profile-picker-panel");
    const trigger = document.getElementById("profile-picker-trigger");

    if (!panel || panel.hidden) {
        return;
    }

    panel.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
}


function filterProfileOptions(query) {
    const normalized = String(query || "").trim().toLowerCase();
    document.querySelectorAll("[data-profile-option]").forEach((node) => {
        node.hidden = normalized ? !node.textContent.toLowerCase().includes(normalized) : false;
    });
}


async function handleProfileOptionSelect(profileId) {
    if (!profileId) {
        return;
    }

    try {
        if (state.activeConversationId && state.activeConversation) {
            await updateConversation({
                id: state.activeConversationId,
                profile_id: profileId,
            });
            state.activeConversation.profile_id = profileId;
            await loadConversations();
        } else {
            state.pendingProfileId = profileId;
        }

        closeProfilePicker();
        renderProfilePicker();
        renderConversationHeader();
    } catch (error) {
        showStatus(error.message || "No se pudo cambiar el perfil del chat.", true);
    }
}


function readProfileFormValues({
    idInput,
    nameInput,
    personalityInput,
    tagsInput,
    systemPromptInput,
    temperatureInput,
    topPInput,
    maxTokensInput,
    defaultInput,
}) {
    return {
        id: Number(idInput?.value || "0") || undefined,
        name: nameInput.value.trim(),
        personality: personalityInput.value.trim(),
        tags: tagsInput.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        system_prompt: systemPromptInput.value.trim(),
        temperature: Number(temperatureInput.value || "0.7"),
        top_p: Number(topPInput.value || "1"),
        max_tokens: Number(maxTokensInput.value || "2048"),
        is_default: defaultInput.checked,
    };
}


async function handleLogout() {
    try {
        await send_API_request("POST", "/logout");
    } catch (error) {
        console.warn("Logout server call failed:", error);
    }

    state.workspaceMode = "home";
    delete_token();
    loadPage("/login");
}


function openCreateProfileModal(context = "settings") {
    state.profileModalMode = "create";
    state.profileModalProfileId = null;
    state.profileModalContext = context;
    populateProfileModal();
    openProfileModal();
    elements.profileNameInput?.focus({ preventScroll: true });
}


function handleSettingsProfileEdit(profileId) {
    if (!profileId) {
        return;
    }

    const profile = state.profiles.find((item) => item.id === profileId);
    if (!profile) {
        showStatus("No se encontró el perfil seleccionado.", true);
        return;
    }

    state.selectedSettingsProfileId = profileId;
    state.profileModalMode = "edit";
    state.profileModalProfileId = profileId;
    state.profileModalContext = "settings";
    populateProfileModal(profile);
    renderSettingsProfilesManager();
    openProfileModal();
    elements.profileNameInput?.focus({ preventScroll: true });
}


async function handleSettingsProfileDelete(profileId) {
    if (!profileId) {
        return;
    }

    const profile = state.profiles.find((item) => item.id === profileId);
    if (!profile) {
        showStatus("No se encontró el perfil seleccionado.", true);
        return;
    }

    const confirmed = await confirmAction({
        eyebrow: "Perfil",
        title: "Borrar perfil",
        message: `Se borrará "${profile.name}". Los chats que lo usaban pasarán a quedar sin perfil explícito.`,
        confirmLabel: "Borrar perfil",
        confirmVariant: "danger",
    });

    if (!confirmed) {
        return;
    }

    try {
        await deleteProfile(profileId);
        await loadProfiles();
        await loadConversations();

        const fallbackProfileId = getDefaultProfileId();

        if (Number(state.pendingProfileId) === profileId) {
            state.pendingProfileId = fallbackProfileId;
        }

        if (state.activeConversation && Number(state.activeConversation.profile_id) === profileId) {
            state.activeConversation.profile_id = fallbackProfileId;
        }

        if (Number(state.selectedSettingsProfileId) === profileId) {
            state.selectedSettingsProfileId = fallbackProfileId;
        }

        renderSettingsProfilesManager();
        renderProfilePicker();
        renderConversationHeader();
        showStatus("Perfil borrado.");
    } catch (error) {
        showStatus(error.message || "No se pudo borrar el perfil.", true);
    }
}


function populateProfileModal(profile = null) {
    const isEditing = Boolean(profile);
    const tags = Array.isArray(profile?.tags) ? profile.tags.slice(0, 2).join(", ") : "";

    elements.profileModalEyebrow.textContent = isEditing ? "Editar perfil" : "Perfil";
    elements.profileModalTitle.textContent = isEditing ? profile.name : "Crear perfil";
    elements.profileSubmitButton.textContent = isEditing ? "Guardar cambios" : "Crear perfil";
    elements.profileIdInput.value = isEditing ? String(profile.id) : "";
    elements.profileNameInput.value = profile?.name || "";
    elements.profilePersonalityInput.value = profile?.personality || "";
    elements.profileTagsInput.value = tags;
    elements.profileSystemPromptInput.value = profile?.system_prompt || "";
    elements.profileTemperatureInput.value = String(profile?.temperature ?? 0.7);
    elements.profileTopPInput.value = String(profile?.top_p ?? 1);
    elements.profileMaxTokensInput.value = String(profile?.max_tokens ?? 2048);
    elements.profileDefaultInput.checked = Boolean(profile?.is_default);
}
