import { delete_token, send_API_request } from "../SERVER_CONN/token-handler.js";


export async function apiRequestJson(method, endpoint, body = null) {
    const response = await send_API_request(method, endpoint, body);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage = payload.error?.message
            || payload.error
            || payload.message
            || `Request failed: ${response.status}`;

        if (response.status === 401) {
            delete_token();
            window.location.href = "/login";
            throw new Error("Tu sesión ha expirado.");
        }

        throw new Error(errorMessage);
    }

    if (
        payload.error
        && !payload.response
        && !payload.providers
        && !payload.projects
        && !payload.profiles
        && !payload.conversations
        && !payload.setting
        && !payload.settings
    ) {
        throw new Error(payload.error.message || payload.error);
    }

    return payload;
}


export async function loadProjectsData() {
    return apiRequestJson("GET", "/api/projects");
}


export async function loadProfilesData() {
    return apiRequestJson("GET", "/api/profiles");
}


export async function loadConversationsData(projectId) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    return apiRequestJson("GET", `/api/conversations${query}`);
}


export async function loadConversationDetailData(conversationId) {
    return apiRequestJson(
        "GET",
        `/api/conversations?id=${encodeURIComponent(conversationId)}&include_messages=1`
    );
}


export async function loadModelsData() {
    return apiRequestJson("GET", "/api/models");
}


export async function loadSettingsData() {
    return apiRequestJson("GET", "/api/settings");
}


export async function createProject(data) {
    return apiRequestJson("POST", "/api/projects", data);
}


export async function updateProject(data) {
    return apiRequestJson("PATCH", "/api/projects", data);
}


export async function deleteProject(projectId) {
    return apiRequestJson("DELETE", `/api/projects?id=${encodeURIComponent(projectId)}`);
}


export async function createProfile(data) {
    return apiRequestJson("POST", "/api/profiles", data);
}

export async function updateProfile(data) {
    return apiRequestJson("PATCH", "/api/profiles", data);
}

export async function deleteProfile(profileId) {
    return apiRequestJson("DELETE", `/api/profiles?id=${encodeURIComponent(profileId)}`);
}


export async function createConversation(data) {
    return apiRequestJson("POST", "/api/conversations", data);
}


export async function updateConversation(data) {
    return apiRequestJson("PATCH", "/api/conversations", data);
}


export async function deleteConversation(conversationId) {
    return apiRequestJson("DELETE", `/api/conversations?id=${encodeURIComponent(conversationId)}`);
}


export async function sendChat(data) {
    return apiRequestJson("POST", "/api/chat", data);
}


export async function persistSetting(key, value) {
    return apiRequestJson("POST", "/api/settings", { key, value });
}
