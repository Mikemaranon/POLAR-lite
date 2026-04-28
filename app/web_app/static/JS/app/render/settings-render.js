import { elements } from "../dom.js";
import { escapeHtml } from "../html.js";
import { PROFILE_SETTINGS_PREVIEW_TAGS } from "../profile-helpers.js";
import { getDefaultProfileId, getSelectedProfileId } from "../selectors.js";
import { setSelectedSettingsProfileId } from "../state-actions.js";
import { state } from "../state.js";


export function renderSettingsSpace() {
    elements.settingsSpace.hidden = state.workspaceMode !== "settings";
}


export function renderSettingsProfilesManager() {
    if (!elements.settingsProfilesList) {
        return;
    }

    const profiles = state.profiles || [];
    const fallbackProfileId = profiles.some(
        (profile) => profile.id === Number(state.selectedSettingsProfileId)
    )
        ? Number(state.selectedSettingsProfileId)
        : getDefaultProfileId();
    setSelectedSettingsProfileId(fallbackProfileId || null);

    elements.settingsProfilesList.innerHTML = profiles.length
        ? profiles.map((profile) => {
            const isSelected = profile.id === Number(state.selectedSettingsProfileId);
            const defaultBadge = profile.is_default
                ? `<span class="profile-summary-card__badge">Default</span>`
                : "";
            const personality = profile.personality || "Sin personalidad definida";
            const tags = Array.isArray(profile.tags) ? profile.tags.slice(0, PROFILE_SETTINGS_PREVIEW_TAGS) : [];
            const tagsMarkup = tags.length
                ? tags.map((tag) => `
                    <span class="profile-summary-card__tag">${escapeHtml(tag)}</span>
                `).join("")
                : `<span class="profile-summary-card__tag profile-summary-card__tag--muted">Sin etiquetas</span>`;

            return `
                <article class="profile-summary-card${isSelected ? " is-selected" : ""}" data-settings-profile-card="${profile.id}">
                    <div class="profile-summary-card__top">
                        <div class="profile-summary-card__heading">
                            <strong class="profile-summary-card__name">${escapeHtml(profile.name)}</strong>
                            <p class="profile-summary-card__personality">${escapeHtml(personality)}</p>
                        </div>
                        <div class="profile-summary-card__status">
                            ${defaultBadge}
                        </div>
                    </div>
                    <div class="profile-summary-card__footer">
                        <div class="profile-summary-card__tags">${tagsMarkup}</div>
                        <div class="profile-summary-card__actions">
                            <button
                                class="ghost-button ghost-button--compact"
                                type="button"
                                data-edit-profile-id="${profile.id}"
                            >
                                Editar
                            </button>
                            <button
                                class="action-button action-button--danger action-button--compact"
                                type="button"
                                data-delete-profile-id="${profile.id}"
                            >
                                Borrar
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join("")
        : `<div class="profiles-manager__empty">Todavía no hay perfiles guardados.</div>`;
}


export function renderProfilePicker() {
    if (!elements.profilePicker) {
        return;
    }

    const profiles = state.profiles || [];
    const selectedProfileId = getSelectedProfileId();
    const selectedProfile = profiles.find((profile) => profile.id === Number(selectedProfileId)) || null;

    const optionsMarkup = profiles.length
        ? profiles.map((profile) => {
            const isSelected = profile.id === Number(selectedProfileId);
            const suffix = profile.is_default ? " · default" : "";
            return `
                <button
                    class="profile-picker__option${isSelected ? " is-selected" : ""}"
                    type="button"
                    data-profile-option="${profile.id}"
                >
                    <span class="profile-picker__option-name">${escapeHtml(profile.name)}</span>
                    <span class="profile-picker__option-meta">${escapeHtml((profile.system_prompt || "Sin system prompt") + suffix)}</span>
                </button>
            `;
        }).join("")
        : `<div class="profile-picker__empty">Todavía no hay perfiles. Crea el primero desde aquí.</div>`;

    elements.profilePicker.innerHTML = `
        <div class="selection-field">
            <div class="selection-field__search">
                <div class="profile-picker__search-shell">
                    <label class="field field--stacked profile-picker__search-field">
                        <span>Buscar perfil</span>
                        <input
                            id="profile-picker-search"
                            type="search"
                            placeholder="Busca por nombre o prompt..."
                            autocomplete="off"
                            aria-expanded="false"
                            aria-controls="profile-picker-panel"
                        >
                    </label>
                    <div id="profile-picker-panel" class="profile-picker__panel" hidden>
                        <div id="profile-picker-results" class="selection-field__results">
                            ${optionsMarkup}
                        </div>
                        <div id="profile-picker-no-results" class="profile-picker__empty" hidden>
                            No hay perfiles que coincidan con la búsqueda actual.
                        </div>
                    </div>
                </div>
            </div>
            <div class="profile-picker__current" aria-live="polite">
                <span class="profile-picker__trigger-copy">
                    <strong>${escapeHtml(selectedProfile?.name || "Sin perfil activo")}</strong>
                    <span>${escapeHtml(selectedProfile?.system_prompt || "Selecciona un perfil para este chat.")}</span>
                </span>
            </div>
        </div>
    `;
}
