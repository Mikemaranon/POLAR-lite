import { elements } from "./dom.js";


function openModal(modal) {
    modal.hidden = false;
    modal.dataset.state = "closed";
    document.body.classList.add("is-modal-open", "modal-open");

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            modal.dataset.state = "open";
        });
    });
}


function closeModal(modal) {
    if (modal.hidden || modal.dataset.state === "closing") {
        return;
    }

    modal.dataset.state = "closing";

    window.setTimeout(() => {
        modal.hidden = true;
        modal.dataset.state = "closed";

        const anyModalOpen = [...document.querySelectorAll(".modal")].some((item) => !item.hidden);

        if (!anyModalOpen) {
            document.body.classList.remove("is-modal-open", "modal-open");
        }
    }, 240);
}


export function openProfileSwitchModal() {
    openModal(elements.profileSwitchModal);
}


export function closeProfileSwitchModal() {
    closeModal(elements.profileSwitchModal);
}


export function openProfileModal() {
    openModal(elements.profileModal);
}


export function closeProfileModal() {
    closeModal(elements.profileModal);
}


export function openProjectCustomizeModal() {
    openModal(elements.projectCustomizeModal);
}


export function closeProjectCustomizeModal() {
    closeModal(elements.projectCustomizeModal);
}


export function openDocumentsModal() {
    openModal(elements.documentsModal);
}


export function closeDocumentsModal() {
    closeModal(elements.documentsModal);
}
