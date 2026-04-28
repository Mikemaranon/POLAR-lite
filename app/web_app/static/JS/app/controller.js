import { configureAppCallbacks, renderApp } from "./app-runtime.js";
import { autoResizeComposer } from "./composer-ui.js";
import {
    createConversationFromUI,
    disableMessagesAutoScroll,
    ensureActiveConversation,
    handleCloudProviderChange,
    handleComposerKeyDown,
    handleComposerSubmit,
    handleConversationDelete,
    handleConversationSelect,
    handleModelChange,
    handleProviderChange,
    handleSendButtonClick,
    registerChatCallbacks,
    syncMessagesAutoScrollState,
} from "./controllers/chat-controller.js";
import {
    bindSidebarViewportChangeListener,
    closeSidebar,
    closeSidebarOnMobile,
    dismissStatusBanner,
    handleDocumentKeyDown,
    handleMessagesWheel,
    syncSidebarVisibility,
    toggleSidebar,
} from "./controllers/layout-controller.js";
import {
    handleDocumentClick,
    handleDocumentFocusIn,
    handleDocumentInput,
    handleProfileSubmit,
    openCreateProfileModal,
    closeProfilePicker,
} from "./controllers/profiles-controller.js";
import {
    handleBackToProject,
    handleDocumentsDragLeave,
    handleDocumentsDragOver,
    handleDocumentsDrop,
    handleDocumentsOpen,
    handleDocumentsSelected,
    handleNewProject,
    handleNewProjectChat,
    handleProjectCustomizeSubmit,
    handleProjectDelete,
    handleProjectDocumentDelete,
    handleProjectSelect,
    handleWorkspaceSettingsOpen,
} from "./controllers/projects-controller.js";
import { ensureAuthenticated, handleLogout } from "./controllers/session-controller.js";
import { handleSettingsSubmit } from "./controllers/settings-controller.js";
import { elements } from "./dom.js";
import {
    closeChatSettingsModal,
    closeDocumentsModal,
    closeProfileModal,
    closeProjectCustomizeModal,
    openChatSettingsModal,
    openProjectCustomizeModal,
} from "./modal-ui.js";
import {
    applyConversationsPayload,
    applyModelsPayload,
    applyProfilesPayload,
    applyProjectsPayload,
    applySettingsPayload,
    enterHomeWorkspace,
} from "./state-actions.js";
import { loadConversations, loadModels, loadProfiles, loadProjects, loadSettings } from "./store.js";

const onProjectSelect = (projectId) => handleProjectSelect(projectId, { closeSidebarOnMobile });
const onConversationSelect = (conversationId) => handleConversationSelect(conversationId, { closeSidebarOnMobile });
const onConversationDelete = (conversationId) => handleConversationDelete(conversationId);
const ensureConversation = () => ensureActiveConversation({
    handleConversationSelect: onConversationSelect,
    closeSidebarOnMobile,
});

configureAppCallbacks({
    onConversationDelete,
    onConversationSelect,
    onProjectSelect,
});

registerChatCallbacks({
    handleConversationDelete: onConversationDelete,
    handleConversationSelect: onConversationSelect,
});


export async function bootApp() {
    const [settingsData, profilesData, projectsData, modelsData, conversationsData] = await Promise.all([
        loadSettings(),
        loadProfiles(),
        loadProjects(),
        loadModels(),
        loadConversations(),
    ]);

    applySettingsPayload(settingsData);
    applyProfilesPayload(profilesData);
    applyProjectsPayload(projectsData);
    applyModelsPayload(modelsData);
    applyConversationsPayload(conversationsData);
    enterHomeWorkspace();
    syncSidebarVisibility();
    renderApp();
}


export function bindUI() {
    elements.sidebarToggleButton?.addEventListener("click", toggleSidebar);
    elements.sidebarBackdrop?.addEventListener("click", closeSidebar);
    elements.composerForm.addEventListener("submit", (event) => handleComposerSubmit(event, {
        ensureActiveConversation: ensureConversation,
    }));
    elements.sendButton?.addEventListener("click", handleSendButtonClick);
    elements.composerInput.addEventListener("keydown", handleComposerKeyDown);
    elements.composerInput.addEventListener("input", autoResizeComposer);
    elements.providerSelect.addEventListener("change", handleProviderChange);
    elements.cloudProviderSelect.addEventListener("change", handleCloudProviderChange);
    elements.modelSelect.addEventListener("change", handleModelChange);
    elements.newChatButton.addEventListener("click", () => createConversationFromUI({
        handleConversationSelect: onConversationSelect,
        closeSidebarOnMobile,
    }));
    elements.newProjectButton.addEventListener("click", () => handleNewProject({ closeSidebarOnMobile }));
    elements.newProjectChatButton?.addEventListener("click", () => handleNewProjectChat({
        handleConversationSelect: onConversationSelect,
        closeSidebarOnMobile,
    }));
    elements.addDocumentsButton?.addEventListener("click", handleDocumentsOpen);
    elements.customizeProjectButton?.addEventListener("click", openProjectCustomizeModal);
    elements.workspaceSettingsButton?.addEventListener("click", () => handleWorkspaceSettingsOpen({ closeSidebarOnMobile }));
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
    elements.statusBannerCloseButton?.addEventListener("click", dismissStatusBanner);
    elements.messagesContainer?.addEventListener("scroll", syncMessagesAutoScrollState, { passive: true });
    elements.messagesContainer?.addEventListener("wheel", (event) => handleMessagesWheel(event, {
        disableMessagesAutoScroll,
    }), { passive: true });
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.chatSettingsModal.addEventListener("click", handleChatSettingsModalClick);
    elements.profileModal?.addEventListener("click", handleProfileModalClick);
    elements.projectCustomizeModal?.addEventListener("click", handleProjectModalClick);
    elements.documentsModal?.addEventListener("click", handleDocumentsModalClick);
    document.addEventListener("keydown", (event) => handleDocumentKeyDown(event, { closeProfilePicker }));
    document.querySelectorAll("[data-prompt]").forEach((element) => {
        element.addEventListener("click", () => {
            elements.composerInput.value = element.dataset.prompt || "";
            autoResizeComposer();
            elements.composerInput.focus();
        });
    });
    document.addEventListener("click", (event) => handleDocumentClick(event, { handleProjectDocumentDelete }));
    document.addEventListener("focusin", handleDocumentFocusIn);
    document.addEventListener("input", handleDocumentInput);
    bindSidebarViewportChangeListener();
}


export { ensureAuthenticated };


function handleChatSettingsModalClick(event) {
    if (event.target.dataset.closeModal === "true") {
        closeChatSettingsModal();
    }
}


function handleProfileModalClick(event) {
    if (event.target.dataset.closeProfileModal === "true") {
        closeProfileModal();
    }
}


function handleProjectModalClick(event) {
    if (event.target.dataset.closeProjectModal === "true") {
        closeProjectCustomizeModal();
    }
}


function handleDocumentsModalClick(event) {
    if (event.target.dataset.closeDocumentsModal === "true") {
        closeDocumentsModal();
    }
}
