import { configureAppCallbacks, renderApp } from "./app-runtime.js";
import { autoResizeComposer } from "./composer-ui.js";
import {
    createConversationFromUI,
    disableMessagesAutoScroll,
    ensureActiveConversation,
    handleComposerKeyDown,
    handleComposerSubmit,
    handleConversationDelete,
    handleConversationSelect,
    handleSendButtonClick,
    registerChatCallbacks,
    syncMessagesAutoScrollState,
} from "./controllers/chat-controller.js";
import {
    bindSidebarViewportChangeListener,
    closeChatPanel,
    closeSidebar,
    closeSidebarOnMobile,
    dismissStatusBanner,
    handleChatSidebarClick,
    handleDocumentKeyDown,
    handleMessagesWheel,
    syncChatSidebarSections,
    syncChatPanelVisibility,
    syncSidebarVisibility,
    toggleChatPanel,
    toggleSidebar,
} from "./controllers/layout-controller.js";
import {
    handleActiveChatModelEdit,
    handleModelSearchInput,
    handleModelSubmit,
    openCreateModelModal,
    openModelSwitcher,
    syncChatModelActions,
} from "./controllers/models-controller.js";
import {
    handleActiveChatProfileEdit,
    handleDocumentClick,
    handleDocumentInput,
    handleProfileSubmit,
    openCreateProfileModal,
    openProfileSwitcher,
    syncChatProfileActions,
} from "./controllers/profiles-controller.js";
import {
    handleProviderSubmit,
    openCreateProviderModal,
} from "./controllers/providers-controller.js";
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
import { elements } from "./dom.js";
import {
    closeDocumentsModal,
    closeModelModal,
    closeModelSwitchModal,
    closeProfileModal,
    closeProfileSwitchModal,
    closeProjectCustomizeModal,
    closeProviderModal,
    openProjectCustomizeModal,
} from "./modal-ui.js";
import {
    applyConversationsPayload,
    applyModelsPayload,
    applyProfilesPayload,
    applyProjectsPayload,
    applyProvidersPayload,
    applySettingsPayload,
    enterHomeWorkspace,
} from "./state-actions.js";
import { loadConversations, loadModels, loadProfiles, loadProjects, loadProviders, loadSettings } from "./store.js";

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
    const [settingsData, providersData, profilesData, projectsData, modelsData, conversationsData] = await Promise.all([
        loadSettings(),
        loadProviders(),
        loadProfiles(),
        loadProjects(),
        loadModels(),
        loadConversations(),
    ]);

    applySettingsPayload(settingsData);
    applyProvidersPayload(providersData);
    applyProfilesPayload(profilesData);
    applyProjectsPayload(projectsData);
    applyModelsPayload(modelsData);
    applyConversationsPayload(conversationsData);
    enterHomeWorkspace();
    syncSidebarVisibility();
    syncChatPanelVisibility();
    syncChatSidebarSections();
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
    elements.chatSettingsButton?.addEventListener("click", toggleChatPanel);
    elements.chatPanelBackdrop?.addEventListener("click", closeChatPanel);
    elements.chatSidePanel?.addEventListener("click", handleChatSidebarClick);
    elements.backToProjectButton?.addEventListener("click", handleBackToProject);
    elements.changeModelButton?.addEventListener("click", () => openModelSwitcher("chat-settings"));
    elements.editModelButton?.addEventListener("click", handleActiveChatModelEdit);
    elements.changeProfileButton?.addEventListener("click", openProfileSwitcher);
    elements.editProfileButton?.addEventListener("click", handleActiveChatProfileEdit);
    elements.settingsNewProviderButton?.addEventListener("click", openCreateProviderModal);
    elements.settingsNewModelButton?.addEventListener("click", () => openCreateModelModal("settings"));
    elements.closeModelSwitchButton?.addEventListener("click", closeModelSwitchModal);
    elements.closeModelButton?.addEventListener("click", closeModelModal);
    elements.closeProviderButton?.addEventListener("click", closeProviderModal);
    elements.closeProfileSwitchButton?.addEventListener("click", closeProfileSwitchModal);
    elements.closeProfileButton?.addEventListener("click", closeProfileModal);
    elements.closeProjectCustomizeButton?.addEventListener("click", closeProjectCustomizeModal);
    elements.closeDocumentsButton?.addEventListener("click", closeDocumentsModal);
    elements.modelForm?.addEventListener("submit", handleModelSubmit);
    elements.providerForm?.addEventListener("submit", handleProviderSubmit);
    elements.profileForm.addEventListener("submit", handleProfileSubmit);
    elements.projectCustomizeForm?.addEventListener("submit", handleProjectCustomizeSubmit);
    elements.deleteProjectButton?.addEventListener("click", handleProjectDelete);
    elements.settingsNewProfileButton?.addEventListener("click", () => openCreateProfileModal("settings"));
    elements.modelCancelButton?.addEventListener("click", closeModelModal);
    elements.providerCancelButton?.addEventListener("click", closeProviderModal);
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
    elements.modelSwitchModal?.addEventListener("click", handleModelSwitchModalClick);
    elements.modelModal?.addEventListener("click", handleModelModalClick);
    elements.providerModal?.addEventListener("click", handleProviderModalClick);
    elements.profileSwitchModal?.addEventListener("click", handleProfileSwitchModalClick);
    elements.profileModal?.addEventListener("click", handleProfileModalClick);
    elements.projectCustomizeModal?.addEventListener("click", handleProjectModalClick);
    elements.documentsModal?.addEventListener("click", handleDocumentsModalClick);
    elements.modelSwitchSearchInput?.addEventListener("input", handleModelSearchInput);
    document.addEventListener("keydown", handleDocumentKeyDown);
    document.querySelectorAll("[data-prompt]").forEach((element) => {
        element.addEventListener("click", () => {
            elements.composerInput.value = element.dataset.prompt || "";
            autoResizeComposer();
            elements.composerInput.focus();
        });
    });
    document.addEventListener("click", (event) => handleDocumentClick(event, { handleProjectDocumentDelete }));
    document.addEventListener("input", handleDocumentInput);
    bindSidebarViewportChangeListener();
    syncChatSidebarSections();
    syncChatModelActions();
    syncChatProfileActions();
}


export { ensureAuthenticated };


function handleModelSwitchModalClick(event) {
    if (event.target.dataset.closeModelSwitchModal === "true") {
        closeModelSwitchModal();
    }
}


function handleModelModalClick(event) {
    if (event.target.dataset.closeModelModal === "true") {
        closeModelModal();
    }
}


function handleProviderModalClick(event) {
    if (event.target.dataset.closeProviderModal === "true") {
        closeProviderModal();
    }
}


function handleProfileSwitchModalClick(event) {
    if (event.target.dataset.closeProfileSwitchModal === "true") {
        closeProfileSwitchModal();
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
