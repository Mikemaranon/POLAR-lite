import { getRootProviderForActualProvider, isCloudProvider } from "./provider-helpers.js";
import { state } from "./state.js";


export function setWorkspaceMode(mode) {
    state.workspaceMode = mode;
}


export function setActiveProjectId(projectId) {
    state.activeProjectId = projectId || null;
}


export function setActiveConversationId(conversationId) {
    state.activeConversationId = conversationId || null;
}


export function setActiveConversation(conversation) {
    state.activeConversation = conversation || null;
}


export function patchActiveConversation(fields = {}) {
    if (!state.activeConversation) {
        state.activeConversation = { ...fields };
        return;
    }

    state.activeConversation = {
        ...state.activeConversation,
        ...fields,
    };
}


export function setActiveMessages(messages = []) {
    state.activeMessages = messages;
}


export function clearActiveConversation() {
    setActiveConversationId(null);
    setActiveConversation(null);
    setActiveMessages([]);
}


export function setPendingProfileId(profileId) {
    state.pendingProfileId = profileId || null;
}


export function setSelectedSettingsProfileId(profileId) {
    state.selectedSettingsProfileId = profileId || null;
}


export function setProfileModalState({ mode, profileId = null, context = "settings" }) {
    state.profileModalMode = mode;
    state.profileModalProfileId = profileId;
    state.profileModalContext = context;
}


export function setProjectDocuments(documents = []) {
    state.projectDocuments = documents;
}


export function setStagedDocuments(documents = []) {
    state.stagedDocuments = documents;
}


export function setSelectedProvider(provider) {
    state.selectedProvider = provider || state.selectedProvider;
}


export function setSelectedCloudProvider(provider) {
    state.selectedCloudProvider = provider || state.selectedCloudProvider;
}


export function rememberSelectedModel(provider, model) {
    if (!provider || !model) {
        return;
    }

    state.modelSelections[provider] = model;
}


export function removeSelectedModel(provider) {
    if (!provider) {
        return;
    }

    delete state.modelSelections[provider];
}


export function setActiveGenerationRequestId(requestId = null) {
    state.activeGenerationRequestId = requestId || null;
}


export function setGenerationStopRequested(isRequested) {
    state.generationStopRequested = Boolean(isRequested);
}


export function applyProjectsPayload(data) {
    state.projects = data.projects || [];

    if (state.activeProjectId && !state.projects.some((project) => project.id === state.activeProjectId)) {
        state.activeProjectId = null;
        state.projectDocuments = [];
    }
}


export function applyProfilesPayload(data) {
    state.profiles = data.profiles || [];
}


export function applyProjectDocumentsPayload(data) {
    state.projectDocuments = data.documents || [];
}


export function applyConversationsPayload(data) {
    state.conversations = data.conversations || [];

    if (!state.activeConversationId) {
        return;
    }

    const matchingConversation = state.conversations.find(
        (conversation) => conversation.id === state.activeConversationId
    );

    if (!matchingConversation) {
        clearActiveConversation();
        return;
    }

    state.activeConversation = {
        ...(state.activeConversation || {}),
        ...matchingConversation,
    };
}


export function applyConversationDetailPayload(data) {
    const conversation = data.conversation;
    state.activeConversation = conversation;
    state.activeConversationId = conversation.id;
    state.activeMessages = data.messages || [];
    state.activeProjectId = conversation.project_id || null;
    state.selectedProvider = getRootProviderForActualProvider(conversation.provider) || state.selectedProvider;

    if (isCloudProvider(conversation.provider)) {
        state.selectedCloudProvider = conversation.provider;
    }

    if (conversation.provider && conversation.model) {
        rememberSelectedModel(conversation.provider, conversation.model);
    }

    state.workspaceMode = "conversation";
}


export function applyModelsPayload(data) {
    state.providerCatalogs = data.providers || [];
}


export function applySettingsPayload(data) {
    const settings = {};

    for (const item of data.settings || []) {
        settings[item.key] = item.value;
    }

    state.settings = settings;
}


export function enterHomeWorkspace() {
    state.workspaceMode = "home";
    state.activeProjectId = null;
    clearActiveConversation();
    state.projectDocuments = [];
    state.stagedDocuments = [];
}


export function enterProjectWorkspace(projectId) {
    state.workspaceMode = "project";
    state.activeProjectId = projectId || null;
    clearActiveConversation();
}


export function enterConversationWorkspace() {
    state.workspaceMode = "conversation";
}


export function enterSettingsWorkspace() {
    state.workspaceMode = "settings";
}
