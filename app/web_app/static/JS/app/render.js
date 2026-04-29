import { syncComposerAvailability } from "./composer-ui.js";
import { renderChatSurface, renderConversationHeader, renderMessages } from "./render/chat-render.js";
import { renderProjectSpace, renderDocumentsFileList } from "./render/project-render.js";
import {
    renderChatPanel,
    renderSettingsProvidersManager,
    renderSettingsModelsManager,
    renderSettingsProfilesManager,
    renderSettingsSpace,
} from "./render/settings-render.js";
import { renderConversations, renderProjects } from "./render/sidebar-render.js";


export function renderAll({ onProjectSelect, onConversationSelect, onConversationDelete } = {}) {
    renderProjects(onProjectSelect);
    renderConversations(onConversationSelect, onConversationDelete);
    renderProjectSpace(onConversationSelect, onConversationDelete);
    renderSettingsSpace();
    renderSettingsProvidersManager();
    renderSettingsModelsManager();
    renderSettingsProfilesManager();
    renderChatPanel();
    renderChatSurface();
    renderDocumentsFileList();
    syncComposerAvailability();
}

export {
    renderConversationHeader,
    renderConversations,
    renderDocumentsFileList,
    renderMessages,
    renderChatPanel,
    renderProjectSpace,
    renderProjects,
    renderSettingsProvidersManager,
    renderSettingsModelsManager,
    renderSettingsProfilesManager,
    renderSettingsSpace,
};
