import { elements } from "../dom.js";
import { state } from "../state.js";
import { closeChatSettingsModal, closeDocumentsModal, closeProfileModal, closeProjectCustomizeModal } from "../modal-ui.js";
import { hideStatus } from "../status-ui.js";

const mobileSidebarMediaQuery = window.matchMedia("(max-width: 1120px)");


export function handleMessagesWheel(event, { disableMessagesAutoScroll }) {
    if (event.deltaY < 0) {
        disableMessagesAutoScroll();
    }
}


export function syncSidebarVisibility() {
    if (!isMobileSidebarViewport()) {
        state.isSidebarOpen = false;
    }

    elements.appShell?.classList.toggle("is-sidebar-open", Boolean(state.isSidebarOpen && isMobileSidebarViewport()));
    document.body.classList.toggle("is-sidebar-open", Boolean(state.isSidebarOpen && isMobileSidebarViewport()));
    syncSidebarToggleAria();
}


export function bindSidebarViewportChangeListener() {
    const listener = () => syncSidebarVisibility();

    if (typeof mobileSidebarMediaQuery.addEventListener === "function") {
        mobileSidebarMediaQuery.addEventListener("change", listener);
        return;
    }

    if (typeof mobileSidebarMediaQuery.addListener === "function") {
        mobileSidebarMediaQuery.addListener(listener);
    }
}


export function openSidebar() {
    if (!isMobileSidebarViewport()) {
        return false;
    }

    state.isSidebarOpen = true;
    syncSidebarVisibility();
    return true;
}


export function closeSidebar() {
    if (!state.isSidebarOpen) {
        return false;
    }

    state.isSidebarOpen = false;
    syncSidebarVisibility();
    return true;
}


export function toggleSidebar() {
    if (state.isSidebarOpen) {
        closeSidebar();
        return;
    }

    openSidebar();
}


export function closeSidebarOnMobile() {
    if (!isMobileSidebarViewport()) {
        return;
    }

    closeSidebar();
}


export function dismissStatusBanner() {
    hideStatus();
}


export function handleDocumentKeyDown(event, { closeProfilePicker }) {
    if (event.key !== "Escape") {
        return;
    }

    if (closeSidebar()) {
        event.stopPropagation();
        return;
    }

    if (closeProfilePicker()) {
        event.stopPropagation();
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


function isMobileSidebarViewport() {
    return mobileSidebarMediaQuery.matches;
}


function syncSidebarToggleAria() {
    const isOpen = Boolean(state.isSidebarOpen && isMobileSidebarViewport());

    if (elements.sidebarToggleButton) {
        elements.sidebarToggleButton.setAttribute("aria-expanded", String(isOpen));
        elements.sidebarToggleButton.setAttribute(
            "aria-label",
            isOpen ? "Cerrar navegación lateral" : "Abrir navegación lateral"
        );
    }

    if (elements.appSidebar) {
        elements.appSidebar.setAttribute("aria-hidden", String(!isOpen && isMobileSidebarViewport()));
    }
}
