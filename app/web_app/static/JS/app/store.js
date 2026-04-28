import {
    loadConversationDetailData,
    loadConversationsData,
    loadModelsData,
    loadProfilesData,
    loadProjectDocumentsData,
    loadProjectsData,
    loadSettingsData,
} from "./api.js";


export async function loadProjects() {
    return loadProjectsData();
}


export async function loadProfiles() {
    return loadProfilesData();
}


export async function loadProjectDocuments(projectId) {
    if (!projectId) {
        return { documents: [] };
    }

    return loadProjectDocumentsData(projectId);
}


export async function loadConversations(projectId) {
    return loadConversationsData(projectId);
}


export async function loadConversationDetail(conversationId) {
    return loadConversationDetailData(conversationId);
}


export async function loadModels() {
    return loadModelsData();
}


export async function loadSettings() {
    return loadSettingsData();
}
