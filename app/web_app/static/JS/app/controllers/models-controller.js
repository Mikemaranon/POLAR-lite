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

const ALLOWED_MODEL_ICON_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);
const MAX_MODEL_ICON_SIZE_BYTES = 512 * 1024;


export async function handleModelSubmit(event) {
    event.preventDefault();

    try {
        const modelPayload = await readModelFormValues();
        if (!modelPayload.name) {
            showStatus("El modelo necesita un nombre técnico.", true);
            return;
        }
        if (!modelPayload.provider_id) {
            showStatus("Selecciona un proveedor para este modelo.", true);
            return;
        }

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
    elements.modelDisplayNameInput?.focus({ preventScroll: true });
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
    elements.modelDisplayNameInput?.focus({ preventScroll: true });
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
        message: `Se borrará "${model.display_name || model.name}". Los chats que lo usaban pasarán al modelo de respaldo que determine la aplicación.`,
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


export async function handleModelIconInputChange() {
    try {
        const iconImage = await readModelIconFromInput();
        setModelIconValue(iconImage);
    } catch (error) {
        resetModelIconInputs();
        showStatus(error.message || "No se pudo cargar el icono del modelo.", true);
    }
}


export function handleModelIconClear() {
    resetModelIconInputs();
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


async function readModelFormValues() {
    const iconImage = await readModelIconFromInput();
    if (iconImage || !elements.modelIconDataInput?.value) {
        setModelIconValue(iconImage);
    }

    return {
        id: Number(elements.modelIdInput?.value || "0") || undefined,
        display_name: elements.modelDisplayNameInput?.value.trim() || "",
        name: elements.modelNameInput?.value.trim() || "",
        provider_id: Number(elements.modelProviderSelect?.value || "0") || undefined,
        icon_image: elements.modelIconDataInput?.value || "",
        is_default: Boolean(elements.modelDefaultInput?.checked),
        is_builtin: elements.modelBuiltinInput?.value === "true",
    };
}


function populateModelModal(model = null) {
    const isEditing = Boolean(model);
    const modelLabel = model?.display_name || model?.name || "";

    elements.modelModalEyebrow.textContent = isEditing ? "Editar modelo" : "Modelo";
    elements.modelModalTitle.textContent = isEditing ? modelLabel : "Crear modelo";
    elements.modelSubmitButton.textContent = isEditing ? "Guardar cambios" : "Crear modelo";
    elements.modelIdInput.value = isEditing ? String(model.id) : "";
    elements.modelBuiltinInput.value = isEditing && model.is_builtin ? "true" : "false";
    elements.modelDisplayNameInput.value = model?.display_name || model?.name || "";
    elements.modelNameInput.value = model?.name || "";
    elements.modelProviderSelect.innerHTML = getModelProviderOptionsMarkup(model?.provider_id || state.providers[0]?.id || null);
    elements.modelProviderSelect.value = String(model?.provider_id || state.providers[0]?.id || "");
    elements.modelDefaultInput.checked = Boolean(model?.is_default);
    if (elements.modelIconInput) {
        elements.modelIconInput.value = "";
    }
    setModelIconValue(model?.icon_image || "");
}


async function readModelIconFromInput() {
    const file = elements.modelIconInput?.files?.[0];
    if (!file) {
        return "";
    }

    if (!ALLOWED_MODEL_ICON_TYPES.has(file.type)) {
        throw new Error("El icono debe ser PNG, JPEG, WEBP o GIF.");
    }

    if (file.size > MAX_MODEL_ICON_SIZE_BYTES) {
        throw new Error("El icono supera el límite de 512 KB.");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer el icono seleccionado."));
        reader.readAsDataURL(file);
    });
}


function resetModelIconInputs() {
    if (elements.modelIconInput) {
        elements.modelIconInput.value = "";
    }
    setModelIconValue("");
}


function setModelIconValue(iconImage) {
    if (elements.modelIconDataInput) {
        elements.modelIconDataInput.value = iconImage || "";
    }
    syncModelIconPreview(iconImage || "");
}


function syncModelIconPreview(iconImage) {
    if (!elements.modelIconPreview) {
        return;
    }

    const hasIcon = Boolean(iconImage);
    elements.modelIconPreview.innerHTML = hasIcon
        ? `<img src="${iconImage}" alt="Vista previa del icono del modelo">`
        : `<span>AI</span>`;

    elements.modelIconPreview.classList.toggle("is-empty", !hasIcon);

    if (elements.modelIconClearButton) {
        elements.modelIconClearButton.hidden = !hasIcon;
    }
}
