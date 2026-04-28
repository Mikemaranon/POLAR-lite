import { elements } from "./dom.js";
import { getProviderCatalog, getSelectedModel } from "./provider-helpers.js";
import { state } from "./state.js";


export function autoResizeComposer() {
    elements.composerInput.style.height = "auto";
    elements.composerInput.style.height = `${Math.min(elements.composerInput.scrollHeight, 220)}px`;
}


export function syncComposerAvailability() {
    const isProjectWorkspace = state.workspaceMode === "project";
    const isSettingsWorkspace = state.workspaceMode === "settings";
    const activeCatalog = getProviderCatalog();
    const providerReady = activeCatalog ? activeCatalog.available !== false : true;
    const shouldDisableComposer = isProjectWorkspace || isSettingsWorkspace || !providerReady;

    elements.composerShell.hidden = isProjectWorkspace || isSettingsWorkspace;
    elements.sendButton.disabled = shouldDisableComposer || (state.loading && state.generationStopRequested);
    elements.composerInput.disabled = shouldDisableComposer || state.loading;

    if (state.loading) {
        elements.sendButton.classList.remove("action-button--primary");
        elements.sendButton.classList.add("action-button--danger", "composer__send--stop");
        elements.sendButton.setAttribute("aria-label", state.generationStopRequested ? "Deteniendo" : "Parar");
        elements.sendButton.setAttribute("title", state.generationStopRequested ? "Deteniendo" : "Parar");
        elements.sendButton.innerHTML = `<span class="composer__stop-icon" aria-hidden="true"></span>`;
    } else {
        elements.sendButton.classList.add("action-button--primary");
        elements.sendButton.classList.remove("action-button--danger", "composer__send--stop");
        elements.sendButton.setAttribute("aria-label", "Enviar");
        elements.sendButton.setAttribute("title", "Enviar");
        elements.sendButton.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 20v-6l8-2-8-2V4l19 8-19 8z" fill="currentColor"></path>
            </svg>
        `;
    }

    if (isProjectWorkspace) {
        elements.composerInput.placeholder = "Abre o crea un chat dentro del proyecto para escribir.";
        elements.composerHint.textContent = "Los proyectos gestionan contexto; el texto se escribe dentro de un chat del proyecto.";
    } else if (isSettingsWorkspace) {
        elements.composerInput.placeholder = "Vuelve a un chat para escribir.";
        elements.composerHint.textContent = "Los ajustes generales se gestionan desde esta vista.";
    } else if (!providerReady) {
        elements.composerInput.placeholder = "Este proveedor no está listo para responder todavía.";
        elements.composerHint.textContent = activeCatalog?.error?.message
            || "Completa la configuración del proveedor antes de iniciar el chat.";
    } else if (!getSelectedModel()) {
        elements.composerInput.placeholder = "Selecciona un proveedor y un modelo disponible antes de escribir.";
        elements.composerHint.textContent = "Solo se puede chatear con modelos detectados por el proveedor activo.";
    } else if (state.loading && state.generationStopRequested) {
        elements.composerInput.placeholder = "Deteniendo la respuesta actual...";
        elements.composerHint.textContent = "Esperando a que el proveedor cierre la generación en curso.";
    } else if (state.loading) {
        elements.composerInput.placeholder = "Pulsa parar si quieres cortar esta respuesta.";
        elements.composerHint.textContent = "La respuesta se está generando ahora mismo.";
    } else {
        elements.composerInput.placeholder = "Pregunta cualquier cosa...";
        elements.composerHint.textContent = "`Shift + Enter` para salto de línea";
    }
}


export function setLoading(isLoading) {
    state.loading = isLoading;
    elements.newChatButton.disabled = isLoading;
    elements.newProjectButton.disabled = isLoading;
    if (elements.newProjectChatButton) {
        elements.newProjectChatButton.disabled = isLoading;
    }
    if (elements.addDocumentsButton) {
        elements.addDocumentsButton.disabled = isLoading;
    }
    if (elements.customizeProjectButton) {
        elements.customizeProjectButton.disabled = isLoading;
    }
    syncComposerAvailability();
}
