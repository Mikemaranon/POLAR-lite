import { elements } from "../dom.js";
import { createEmptyListItem, escapeHtml } from "../html.js";
import { getActiveProject, getProjectConversations } from "../selectors.js";
import { state } from "../state.js";


export function renderProjectSpace(onConversationSelect, onConversationDelete) {
    const activeProject = getActiveProject();
    const hasProjectWorkspace = state.workspaceMode === "project" && !!activeProject;

    elements.projectSpace.hidden = !hasProjectWorkspace;

    if (!activeProject) {
        elements.projectConversationsList.innerHTML = "";
        elements.projectChatCount.textContent = "0 chats";
        return;
    }

    elements.projectSpaceTitle.textContent = activeProject.name;
    elements.projectSpaceDescription.textContent = activeProject.description
        || "Este proyecto tiene su propio espacio, separado de los chats puntuales.";
    elements.projectNameInput.value = activeProject.name || "";
    elements.projectDescriptionInput.value = activeProject.description || "";
    elements.projectSystemPromptInput.value = activeProject.system_prompt || "";

    const projectConversations = getProjectConversations(activeProject.id);
    const totalChats = projectConversations.length;
    const totalDocuments = state.projectDocuments.length;
    elements.projectChatCount.textContent = `${totalChats} chat${totalChats === 1 ? "" : "s"} · ${totalDocuments} documento${totalDocuments === 1 ? "" : "s"}`;

    if (!projectConversations.length) {
        elements.projectConversationsList.innerHTML = createEmptyListItem(
            "Este proyecto todavía no tiene chats. Usa el botón + para crear el primero."
        );
        return;
    }

    elements.projectConversationsList.innerHTML = projectConversations
        .map((conversation) => {
            const activeClass = conversation.id === state.activeConversationId ? " is-active" : "";
            return `
                <div class="project-chat-card${activeClass}" data-conversation-row="${conversation.id}">
                    <button class="project-chat-card__main" type="button" data-conversation-id="${conversation.id}">
                        <span class="project-chat-card__title">${escapeHtml(conversation.title || "Nuevo chat")}</span>
                    </button>
                    <button
                        class="icon-button conversation-row__delete"
                        type="button"
                        data-delete-conversation-id="${conversation.id}"
                        aria-label="Borrar chat"
                        title="Borrar chat"
                    >
                        ×
                    </button>
                </div>
            `;
        })
        .join("");

    if (onConversationSelect) {
        elements.projectConversationsList.querySelectorAll("[data-conversation-id]").forEach((element) => {
            element.addEventListener("click", () => onConversationSelect(Number(element.dataset.conversationId)));
        });
    }

    if (onConversationDelete) {
        elements.projectConversationsList.querySelectorAll("[data-delete-conversation-id]").forEach((element) => {
            element.addEventListener("click", () => {
                onConversationDelete(Number(element.dataset.deleteConversationId));
            });
        });
    }
}


export function renderDocumentsFileList() {
    if (!elements.documentsFileList) {
        return;
    }

    const uploadedDocuments = state.projectDocuments || [];
    if (!uploadedDocuments.length && !state.stagedDocuments.length) {
        elements.documentsFileList.innerHTML = `<p class="documents-file-list__empty">No hay documentos seleccionados.</p>`;
        return;
    }

    const uploadedMarkup = uploadedDocuments.map((file) => `
        <div class="documents-file">
            <div class="documents-file__copy">
                <span class="documents-file__name">${escapeHtml(file.filename)}</span>
                <span class="documents-file__meta">${escapeHtml(formatDocumentMeta(file))}</span>
            </div>
            <button
                class="ghost-button ghost-button--compact"
                type="button"
                data-delete-project-document-id="${file.id}"
            >
                Borrar
            </button>
        </div>
    `).join("");

    const stagedMarkup = state.stagedDocuments.map((file) => `
        <div class="documents-file documents-file--pending">
            <div class="documents-file__copy">
                <span class="documents-file__name">${escapeHtml(file.name)}</span>
                <span class="documents-file__meta">${escapeHtml(`${file.sizeLabel} · subiendo…`)}</span>
            </div>
        </div>
    `).join("");

    elements.documentsFileList.innerHTML = `${uploadedMarkup}${stagedMarkup}`;
}


function formatDocumentMeta(document) {
    const sizeInBytes = Number(document.size_bytes || 0);

    if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
    }
    if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeInBytes / 1024 / 1024).toFixed(1)} MB`;
}
