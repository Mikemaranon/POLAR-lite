import {
    loadConversationDetailData,
    loadConversationsData,
    loadModelsData,
    loadProfilesData,
    loadProjectsData,
    loadSettingsData,
} from "./api.js";
import { state } from "./state.js";
import { getRootProviderForActualProvider, isCloudProvider } from "./utils.js";


export async function loadProjects() {
    const data = await loadProjectsData();
    state.projects = data.projects || [];

    if (state.activeProjectId && !state.projects.some((project) => project.id === state.activeProjectId)) {
        state.activeProjectId = null;
    }
}


export async function loadProfiles() {
    const data = await loadProfilesData();
    state.profiles = data.profiles || [];
}


export async function loadConversations(projectId) {
    const data = await loadConversationsData(projectId);
    state.conversations = data.conversations || [];

    if (state.activeConversationId) {
        const stillExists = state.conversations.some(
            (conversation) => conversation.id === state.activeConversationId
        );

        if (!stillExists) {
            state.activeConversationId = null;
            state.activeConversation = null;
            state.activeMessages = [];
        }
    }
}


export async function loadConversationDetail(conversationId) {
    const data = await loadConversationDetailData(conversationId);
    state.activeConversation = data.conversation;
    state.activeConversationId = data.conversation.id;
    state.activeMessages = data.messages || [];
    state.activeProjectId = state.activeConversation.project_id || null;
    state.selectedProvider = getRootProviderForActualProvider(state.activeConversation.provider) || state.selectedProvider;
    if (isCloudProvider(state.activeConversation.provider)) {
        state.selectedCloudProvider = state.activeConversation.provider;
    }
    if (state.activeConversation.provider && state.activeConversation.model) {
        state.modelSelections[state.activeConversation.provider] = state.activeConversation.model;
    }
    state.workspaceMode = "conversation";
}


export async function loadModels() {
    const data = await loadModelsData();
    state.providerCatalogs = data.providers || [];
}


export async function loadSettings() {
    const data = await loadSettingsData();
    const settings = {};

    for (const item of data.settings || []) {
        settings[item.key] = item.value;
    }

    state.settings = settings;
}
