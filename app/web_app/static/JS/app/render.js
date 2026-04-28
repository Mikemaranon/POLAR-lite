import { syncComposerAvailability } from "./composer-ui.js";
import { renderChatSurface, renderConversationHeader, renderMessages, renderProviderControls, populateSettingsForm } from "./render/chat-render.js";
import { renderProjectSpace, renderDocumentsFileList } from "./render/project-render.js";
import { renderSettingsProfilesManager, renderSettingsSpace, renderProfilePicker } from "./render/settings-render.js";
import { renderConversations, renderProjects } from "./render/sidebar-render.js";


export function renderAll({ onProjectSelect, onConversationSelect, onConversationDelete } = {}) {
    renderProjects(onProjectSelect);
    renderConversations(onConversationSelect, onConversationDelete);
    renderProjectSpace(onConversationSelect, onConversationDelete);
    renderSettingsSpace();
    renderSettingsProfilesManager();
    renderProfilePicker();
    renderChatSurface();
    renderDocumentsFileList();
    syncComposerAvailability();
}

export {
    populateSettingsForm,
    renderConversationHeader,
    renderConversations,
    renderDocumentsFileList,
    renderMessages,
    renderProfilePicker,
    renderProjectSpace,
    renderProjects,
    renderProviderControls,
    renderSettingsProfilesManager,
    renderSettingsSpace,
};
