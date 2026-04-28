import { elements } from "./dom.js";


export function showStatus(message, isError = false) {
    elements.statusBanner.hidden = false;
    elements.statusBannerMessage.textContent = message;
    elements.statusBanner.classList.toggle("is-error", isError);

    window.clearTimeout(showStatus.timeoutId);
    showStatus.timeoutId = window.setTimeout(() => {
        elements.statusBanner.hidden = true;
    }, 4200);
}


export function hideStatus() {
    window.clearTimeout(showStatus.timeoutId);
    elements.statusBanner.hidden = true;
}
