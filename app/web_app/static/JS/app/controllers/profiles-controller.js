import { createProfile, deleteProfile, updateConversation, updateProfile } from "../api.js";
import { confirmAction } from "../dialogs.js";
import { elements } from "../dom.js";
import { openProfileModal, closeProfileModal } from "../modal-ui.js";
import { MAX_PROFILE_TAGS } from "../profile-helpers.js";
import { renderConversationHeader, renderProfilePicker, renderSettingsProfilesManager } from "../render.js";
import { getDefaultProfileId } from "../selectors.js";
import {
    applyConversationsPayload,
    applyProfilesPayload,
    patchActiveConversation,
    setPendingProfileId,
    setProfileModalState,
    setSelectedSettingsProfileId,
} from "../state-actions.js";
import { state } from "../state.js";
import { showStatus } from "../status-ui.js";
import { loadConversations, loadProfiles } from "../store.js";


export async function handleProfileSubmit(event) {
    event.preventDefault();

    const profilePayload = readProfileFormValues({
        idInput: elements.profileIdInput,
        nameInput: elements.profileNameInput,
        personalityInput: elements.profilePersonalityInput,
        tagsInput: elements.profileTagsInput,
        systemPromptInput: elements.profileSystemPromptInput,
        temperatureInput: elements.profileTemperatureInput,
        topPInput: elements.profileTopPInput,
        maxTokensInput: elements.profileMaxTokensInput,
        defaultInput: elements.profileDefaultInput,
    });

    if (!profilePayload.name) {
        showStatus("El perfil necesita un nombre.", true);
        return;
    }
    if (profilePayload.tags.length > MAX_PROFILE_TAGS) {
        showStatus(`Las etiquetas admiten un máximo de ${MAX_PROFILE_TAGS} elementos.`, true);
        return;
    }

    try {
        const isEditing = Boolean(profilePayload.id);
        const payload = isEditing
            ? await updateProfile(profilePayload)
            : await createProfile(profilePayload);

        applyProfilesPayload(await loadProfiles());
        setSelectedSettingsProfileId(payload.profile.id);

        if (!isEditing && state.profileModalContext === "chat-settings") {
            if (state.activeConversationId && state.activeConversation) {
                await updateConversation({
                    id: state.activeConversationId,
                    profile_id: payload.profile.id,
                });
                patchActiveConversation({ profile_id: payload.profile.id });
            } else {
                setPendingProfileId(payload.profile.id);
            }
        }

        setProfileModalState({
            mode: "edit",
            profileId: payload.profile.id,
            context: state.profileModalContext,
        });
        populateProfileModal(payload.profile);
        closeProfileModal();

        renderSettingsProfilesManager();
        renderProfilePicker();
        renderConversationHeader();
        showStatus(isEditing ? "Perfil actualizado." : "Perfil creado.");
    } catch (error) {
        showStatus(error.message || "No se pudo guardar el perfil.", true);
    }
}


export async function handleProfileOptionSelect(profileId) {
    if (!profileId) {
        return;
    }

    try {
        if (state.activeConversationId && state.activeConversation) {
            await updateConversation({
                id: state.activeConversationId,
                profile_id: profileId,
            });
            patchActiveConversation({ profile_id: profileId });
            applyConversationsPayload(await loadConversations());
        } else {
            setPendingProfileId(profileId);
        }

        closeProfilePicker();
        renderProfilePicker();
        renderConversationHeader();
    } catch (error) {
        showStatus(error.message || "No se pudo cambiar el perfil del chat.", true);
    }
}


export function openCreateProfileModal(context = "settings") {
    setProfileModalState({
        mode: "create",
        profileId: null,
        context,
    });
    populateProfileModal();
    openProfileModal();
    elements.profileNameInput?.focus({ preventScroll: true });
}


export function handleSettingsProfileEdit(profileId) {
    if (!profileId) {
        return;
    }

    const profile = state.profiles.find((item) => item.id === profileId);
    if (!profile) {
        showStatus("No se encontró el perfil seleccionado.", true);
        return;
    }

    setSelectedSettingsProfileId(profileId);
    setProfileModalState({
        mode: "edit",
        profileId,
        context: "settings",
    });
    populateProfileModal(profile);
    renderSettingsProfilesManager();
    openProfileModal();
    elements.profileNameInput?.focus({ preventScroll: true });
}


export async function handleSettingsProfileDelete(profileId) {
    if (!profileId) {
        return;
    }

    const profile = state.profiles.find((item) => item.id === profileId);
    if (!profile) {
        showStatus("No se encontró el perfil seleccionado.", true);
        return;
    }

    const confirmed = await confirmAction({
        eyebrow: "Perfil",
        title: "Borrar perfil",
        message: `Se borrará "${profile.name}". Los chats que lo usaban pasarán a quedar sin perfil explícito.`,
        confirmLabel: "Borrar perfil",
        confirmVariant: "danger",
    });

    if (!confirmed) {
        return;
    }

    try {
        await deleteProfile(profileId);
        applyProfilesPayload(await loadProfiles());
        applyConversationsPayload(await loadConversations());

        const fallbackProfileId = getDefaultProfileId();

        if (Number(state.pendingProfileId) === profileId) {
            setPendingProfileId(fallbackProfileId);
        }

        if (state.activeConversation && Number(state.activeConversation.profile_id) === profileId) {
            patchActiveConversation({ profile_id: fallbackProfileId });
        }

        if (Number(state.selectedSettingsProfileId) === profileId) {
            setSelectedSettingsProfileId(fallbackProfileId);
        }

        renderSettingsProfilesManager();
        renderProfilePicker();
        renderConversationHeader();
        showStatus("Perfil borrado.");
    } catch (error) {
        showStatus(error.message || "No se pudo borrar el perfil.", true);
    }
}


export function handleDocumentClick(event, { handleProjectDocumentDelete }) {
    const deleteProjectDocumentButton = event.target.closest("[data-delete-project-document-id]");
    if (deleteProjectDocumentButton) {
        handleProjectDocumentDelete(Number(deleteProjectDocumentButton.dataset.deleteProjectDocumentId));
        return;
    }

    const option = event.target.closest("[data-profile-option]");
    if (option) {
        handleProfileOptionSelect(Number(option.dataset.profileOption));
        return;
    }

    const editProfileButton = event.target.closest("[data-edit-profile-id]");
    if (editProfileButton) {
        handleSettingsProfileEdit(Number(editProfileButton.dataset.editProfileId));
        return;
    }

    const deleteProfileButton = event.target.closest("[data-delete-profile-id]");
    if (deleteProfileButton) {
        handleSettingsProfileDelete(Number(deleteProfileButton.dataset.deleteProfileId));
        return;
    }

    if (!event.target.closest("#profile-picker")) {
        closeProfilePicker();
    }
}


export function handleDocumentFocusIn(event) {
    if (event.target.id !== "profile-picker-search") {
        return;
    }

    openProfilePicker();
    filterProfileOptions(event.target.value);
}


export function handleDocumentInput(event) {
    if (event.target.id !== "profile-picker-search") {
        return;
    }

    openProfilePicker();
    filterProfileOptions(event.target.value);
}


export function openProfilePicker() {
    const panel = document.getElementById("profile-picker-panel");
    const search = document.getElementById("profile-picker-search");

    if (!panel) {
        return;
    }

    panel.hidden = false;
    if (search) {
        search.setAttribute("aria-expanded", "true");
    }
}


export function closeProfilePicker() {
    const panel = document.getElementById("profile-picker-panel");
    const search = document.getElementById("profile-picker-search");

    if (!panel || panel.hidden) {
        return false;
    }

    panel.hidden = true;
    search?.setAttribute("aria-expanded", "false");
    return true;
}


export function filterProfileOptions(query) {
    const normalized = String(query || "").trim().toLowerCase();
    let visibleCount = 0;
    let totalOptions = 0;

    document.querySelectorAll("[data-profile-option]").forEach((node) => {
        totalOptions += 1;
        const matches = normalized ? node.textContent.toLowerCase().includes(normalized) : true;
        node.hidden = !matches;
        if (matches) {
            visibleCount += 1;
        }
    });

    const emptyNode = document.getElementById("profile-picker-no-results");
    const resultsNode = document.getElementById("profile-picker-results");

    if (resultsNode) {
        resultsNode.hidden = totalOptions > 0 && visibleCount === 0;
    }
    if (emptyNode) {
        emptyNode.hidden = visibleCount !== 0 || totalOptions === 0;
    }
}


function readProfileFormValues({
    idInput,
    nameInput,
    personalityInput,
    tagsInput,
    systemPromptInput,
    temperatureInput,
    topPInput,
    maxTokensInput,
    defaultInput,
}) {
    return {
        id: Number(idInput?.value || "0") || undefined,
        name: nameInput.value.trim(),
        personality: personalityInput.value.trim(),
        tags: tagsInput.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        system_prompt: systemPromptInput.value.trim(),
        temperature: Number(temperatureInput.value || "0.7"),
        top_p: Number(topPInput.value || "1"),
        max_tokens: Number(maxTokensInput.value || "2048"),
        is_default: defaultInput.checked,
    };
}


function populateProfileModal(profile = null) {
    const isEditing = Boolean(profile);
    const tags = Array.isArray(profile?.tags) ? profile.tags.slice(0, MAX_PROFILE_TAGS).join(", ") : "";

    elements.profileModalEyebrow.textContent = isEditing ? "Editar perfil" : "Perfil";
    elements.profileModalTitle.textContent = isEditing ? profile.name : "Crear perfil";
    elements.profileSubmitButton.textContent = isEditing ? "Guardar cambios" : "Crear perfil";
    elements.profileIdInput.value = isEditing ? String(profile.id) : "";
    elements.profileNameInput.value = profile?.name || "";
    elements.profilePersonalityInput.value = profile?.personality || "";
    elements.profileTagsInput.value = tags;
    elements.profileSystemPromptInput.value = profile?.system_prompt || "";
    elements.profileTemperatureInput.value = String(profile?.temperature ?? 0.7);
    elements.profileTopPInput.value = String(profile?.top_p ?? 1);
    elements.profileMaxTokensInput.value = String(profile?.max_tokens ?? 2048);
    elements.profileDefaultInput.checked = Boolean(profile?.is_default);
}
