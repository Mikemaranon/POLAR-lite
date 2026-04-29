import { createModel, deleteModel, updateConversation, updateModel } from "../api.js";
import { confirmAction } from "../dialogs.js";
import { elements } from "../dom.js";
import {
    closeModelModal,
    closeModelSwitchModal,
    openModelModal,
    openModelSwitchModal,
} from "../modal-ui.js";
import {
    renderChatPanel,
    renderConversationHeader,
    renderSettingsModelsManager,
} from "../render.js";
import { getProviderTypeDisplayName } from "../provider-helpers.js";
import {
    getDefaultModelConfigId,
    getModelConfigById,
    getSelectedModelConfigId,
} from "../selectors.js";
import {
    applyConversationsPayload,
    applyModelsPayload,
    patchActiveConversation,
    setModelModalState,
    setPendingModelConfigId,
    setSelectedSettingsModelId,
} from "../state-actions.js";
import { state } from "../state.js";
import { showStatus } from "../status-ui.js";
import { loadConversations, loadModels } from "../store.js";


export async function handleModelSubmit(event) {
    event.preventDefault();

    const modelPayload = readModelFormValues();
    if (!modelPayload.name) {
        showStatus("El modelo necesita un nombre.", true);
        return;
    }
    if (!modelPayload.provider_id) {
        showStatus("Selecciona un proveedor para este modelo.", true);
        return;
    }

    try {
        const isEditing = Boolean(modelPayload.id);
        const payload = isEditing
            ? await updateModel(modelPayload)
            : await createModel(modelPayload);

        applyModelsPayload(await loadModels());
        applyConversationsPayload(await loadConversations());
        setSelectedSettingsModelId(payload.model.id);

        if (state.modelModalContext === "chat-settings") {
            await assignModelToCurrentChat(payload.model.id);
        } else if (!state.activeConversationId) {
            setPendingModelConfigId(getDefaultModelConfigId());
        }

        setModelModalState({
            mode: "edit",
            modelId: payload.model.id,
            context: state.modelModalContext,
        });
        populateModelModal(payload.model);
        closeModelModal();

        renderSettingsModelsManager();
        renderChatPanel();
        renderConversationHeader();
        showStatus(isEditing ? "Modelo actualizado." : "Modelo creado.");
    } catch (error) {
        showStatus(error.message || "No se pudo guardar el modelo.", true);
    }
}


export async function handleModelOptionSelect(modelConfigId) {
    if (!modelConfigId) {
        return;
    }

    try {
        await assignModelToCurrentChat(modelConfigId);
        closeModelSwitchModal();
        renderChatPanel();
        renderConversationHeader();
    } catch (error) {
        showStatus(error.message || "No se pudo cambiar el modelo.", true);
    }
}


export function openCreateModelModal(context = "settings") {
    if (!(state.providers || []).length) {
        showStatus("Crea al menos un proveedor antes de crear modelos.", true);
        return;
    }

    closeModelSwitchModal();
    setModelModalState({
        mode: "create",
        modelId: null,
        context,
    });
    populateModelModal();
    openModelModal();
    elements.modelNameInput?.focus({ preventScroll: true });
}


export function handleModelEdit(modelConfigId, context = "settings") {
    if (!modelConfigId) {
        return;
    }

    const model = getModelConfigById(modelConfigId);
    if (!model) {
        showStatus("No se encontró el modelo seleccionado.", true);
        return;
    }

    setSelectedSettingsModelId(model.id);
    setModelModalState({
        mode: "edit",
        modelId: model.id,
        context,
    });
    populateModelModal(model);
    renderSettingsModelsManager();
    openModelModal();
    elements.modelNameInput?.focus({ preventScroll: true });
}


export async function handleModelDelete(modelConfigId) {
    if (!modelConfigId) {
        return;
    }

    const model = getModelConfigById(modelConfigId);
    if (!model) {
        showStatus("No se encontró el modelo seleccionado.", true);
        return;
    }

    const confirmed = await confirmAction({
        eyebrow: "Modelo",
        title: "Borrar modelo",
        message: `Se borrará "${model.name}". Los chats que lo usaban pasarán al modelo de respaldo que determine la aplicación.`,
        confirmLabel: "Borrar modelo",
        confirmVariant: "danger",
    });

    if (!confirmed) {
        return;
    }

    try {
        await deleteModel(modelConfigId);
        applyModelsPayload(await loadModels());
        applyConversationsPayload(await loadConversations());
        renderSettingsModelsManager();
        renderChatPanel();
        renderConversationHeader();
        showStatus("Modelo borrado.");
    } catch (error) {
        showStatus(error.message || "No se pudo borrar el modelo.", true);
    }
}


export function handleActiveChatModelEdit() {
    const activeModelId = getSelectedModelConfigId();
    if (!activeModelId) {
        showStatus("No hay un modelo seleccionado para editar.", true);
        return;
    }

    handleModelEdit(Number(activeModelId), "chat-settings");
}


export function syncChatModelActions() {
    if (!elements.editModelButton) {
        return;
    }

    const activeModelId = getSelectedModelConfigId();
    elements.editModelButton.disabled = !activeModelId;
}


export function openModelSwitcher(context = "chat-settings") {
    renderChatPanel();
    if (elements.modelSwitchModal) {
        elements.modelSwitchModal.dataset.context = context;
    }
    openModelSwitchModal();

    if (elements.modelSwitchSearchInput) {
        elements.modelSwitchSearchInput.value = "";
        elements.modelSwitchSearchInput.focus({ preventScroll: true });
        elements.modelSwitchSearchInput.select();
        filterModelSwitchOptions("");
    }
}


export function handleModelSearchInput(event) {
    if (event.target.id !== "model-switch-search") {
        return;
    }

    filterModelSwitchOptions(event.target.value);
}


export function getModelProviderOptionsMarkup(selectedProviderId = null) {
    return (state.providers || []).map((provider) => {
        const selected = Number(selectedProviderId) === provider.id ? " selected" : "";
        return `<option value="${provider.id}"${selected}>${provider.name} · ${getProviderTypeDisplayName(provider.provider_type)}</option>`;
    }).join("");
}


function filterModelSwitchOptions(query) {
    const normalized = String(query || "").trim().toLowerCase();
    let visibleCount = 0;
    let totalOptions = 0;

    elements.modelSwitchResults?.querySelectorAll("[data-model-switch-option]").forEach((node) => {
        totalOptions += 1;
        const matches = normalized ? node.textContent.toLowerCase().includes(normalized) : true;
        node.hidden = !matches;
        if (matches) {
            visibleCount += 1;
        }
    });

    if (elements.modelSwitchResults) {
        elements.modelSwitchResults.hidden = totalOptions > 0 && visibleCount === 0;
    }
    if (elements.modelSwitchNoResults) {
        elements.modelSwitchNoResults.hidden = visibleCount !== 0 || totalOptions === 0;
    }
}


async function assignModelToCurrentChat(modelConfigId) {
    const model = getModelConfigById(modelConfigId);
    if (!model) {
        throw new Error("No se encontró el modelo seleccionado.");
    }

    if (state.activeConversationId && state.activeConversation) {
        await updateConversation({
            id: state.activeConversationId,
            model_config_id: model.id,
        });
        patchActiveConversation({
            model_config_id: model.id,
            provider: model.provider,
            model: model.name,
        });
        applyConversationsPayload(await loadConversations());
    } else {
        setPendingModelConfigId(model.id);
    }
}


function readModelFormValues() {
    return {
        id: Number(elements.modelIdInput?.value || "0") || undefined,
        name: elements.modelNameInput?.value.trim() || "",
        provider_id: Number(elements.modelProviderSelect?.value || "0") || undefined,
        is_default: Boolean(elements.modelDefaultInput?.checked),
        is_builtin: elements.modelBuiltinInput?.value === "true",
    };
}


function populateModelModal(model = null) {
    const isEditing = Boolean(model);

    elements.modelModalEyebrow.textContent = isEditing ? "Editar modelo" : "Modelo";
    elements.modelModalTitle.textContent = isEditing ? model.name : "Crear modelo";
    elements.modelSubmitButton.textContent = isEditing ? "Guardar cambios" : "Crear modelo";
    elements.modelIdInput.value = isEditing ? String(model.id) : "";
    elements.modelBuiltinInput.value = isEditing && model.is_builtin ? "true" : "false";
    elements.modelNameInput.value = model?.name || "";
    elements.modelProviderSelect.innerHTML = getModelProviderOptionsMarkup(model?.provider_id || state.providers[0]?.id || null);
    elements.modelProviderSelect.value = String(model?.provider_id || state.providers[0]?.id || "");
    elements.modelDefaultInput.checked = Boolean(model?.is_default);
}
