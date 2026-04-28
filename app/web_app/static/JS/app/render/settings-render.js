import { elements } from "../dom.js";
import { escapeHtml } from "../html.js";
import { PROFILE_SETTINGS_PREVIEW_TAGS } from "../profile-helpers.js";
import { getDefaultProfileId, getSelectedProfileId } from "../selectors.js";
import { setSelectedSettingsProfileId } from "../state-actions.js";
import { state } from "../state.js";

const CHAT_TOOL_PREVIEW_ITEMS = [
    {
        name: "Buscar en internet",
        summary: "Consulta fuentes web antes de responder.",
    },
    {
        name: "Calculadora",
        summary: "Resuelve operaciones y conversiones rápidas.",
    },
    {
        name: "Fecha actual",
        summary: "Devuelve fecha y zona horaria locales.",
    },
    {
        name: "Resumen de archivos",
        summary: "Preparada para revisar contexto del proyecto.",
    },
    {
        name: "Notas del proyecto",
        summary: "Pensada para recuperar apuntes guardados.",
    },
];


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


export function renderChatPanel() {
    renderChatToolsList();
    renderChatProfileCard();
    renderProfileSwitchModal();
}


export function renderProfileSwitchModal() {
    if (!elements.profileSwitchResults) {
        return;
    }

    const profiles = state.profiles || [];
    const selectedProfileId = getSelectedProfileId();
    const query = elements.profileSwitchSearchInput?.value || "";

    elements.profileSwitchResults.innerHTML = profiles.length
        ? profiles.map((profile) => {
            const isSelected = profile.id === Number(selectedProfileId);
            const suffix = profile.is_default ? " · default" : "";
            return `
                <button
                    class="profile-switch__option${isSelected ? " is-selected" : ""}"
                    type="button"
                    data-profile-switch-option="${profile.id}"
                >
                    <span class="profile-switch__option-name">${escapeHtml(profile.name)}</span>
                    <span class="profile-switch__option-meta">${escapeHtml((profile.system_prompt || "Sin system prompt") + suffix)}</span>
                </button>
            `;
        }).join("")
        : `<div class="profile-switch__empty">Todavía no hay perfiles. Crea el primero desde el panel del chat o desde ajustes.</div>`;

    applyProfileSwitchQueryState(query);
}


function applyProfileSwitchQueryState(query) {
    const normalized = String(query || "").trim().toLowerCase();
    let visibleCount = 0;
    let totalOptions = 0;

    elements.profileSwitchResults?.querySelectorAll("[data-profile-switch-option]").forEach((node) => {
        totalOptions += 1;
        const matches = normalized ? node.textContent.toLowerCase().includes(normalized) : true;
        node.hidden = !matches;
        if (matches) {
            visibleCount += 1;
        }
    });

    if (elements.profileSwitchResults) {
        elements.profileSwitchResults.hidden = totalOptions > 0 && visibleCount === 0;
    }
    if (elements.profileSwitchNoResults) {
        elements.profileSwitchNoResults.hidden = visibleCount !== 0 || totalOptions === 0;
    }
}


function renderChatToolsList() {
    if (!elements.chatToolsList) {
        return;
    }

    elements.chatToolsList.innerHTML = CHAT_TOOL_PREVIEW_ITEMS.map((tool) => `
        <article class="chat-tool-card" aria-disabled="true">
            <div class="chat-tool-card__copy">
                <strong>${escapeHtml(tool.name)}</strong>
                <p>${escapeHtml(tool.summary)}</p>
            </div>
            <span class="chat-tool-card__status">Próximamente</span>
        </article>
    `).join("");
}


function renderChatProfileCard() {
    if (!elements.chatProfileCard) {
        return;
    }

    const selectedProfileId = getSelectedProfileId();
    const profile = (state.profiles || []).find((item) => item.id === Number(selectedProfileId)) || null;

    if (!profile) {
        elements.chatProfileCard.innerHTML = `
            <div class="chat-profile-card__empty">
                No hay perfiles disponibles todavía. Crea uno para definir el comportamiento del chat.
            </div>
        `;
        return;
    }

    const tags = Array.isArray(profile.tags) ? profile.tags.slice(0, PROFILE_SETTINGS_PREVIEW_TAGS) : [];
    const tagsMarkup = tags.length
        ? tags.map((tag) => `<span class="chat-profile-card__tag">${escapeHtml(tag)}</span>`).join("")
        : `<span class="chat-profile-card__tag chat-profile-card__tag--muted">Sin etiquetas</span>`;
    const defaultBadge = profile.is_default
        ? `<span class="chat-profile-card__badge">Default</span>`
        : "";

    elements.chatProfileCard.innerHTML = `
        <article class="chat-profile-card__surface">
            <div class="chat-profile-card__top">
                <div class="chat-profile-card__heading">
                    <strong>${escapeHtml(profile.name)}</strong>
                    <span>${escapeHtml(profile.personality || "Sin personalidad definida")}</span>
                </div>
                ${defaultBadge}
            </div>
            <div class="chat-profile-card__meta">
                <span class="chat-profile-card__metric">Temp ${escapeHtml(String(profile.temperature ?? 0.7))}</span>
                <span class="chat-profile-card__metric">Top P ${escapeHtml(String(profile.top_p ?? 1))}</span>
                <span class="chat-profile-card__metric">Max ${escapeHtml(String(profile.max_tokens ?? 2048))}</span>
            </div>
            <div class="chat-profile-card__tags">${tagsMarkup}</div>
            <div class="chat-profile-card__actions">
                <button
                    class="ghost-button ghost-button--compact"
                    type="button"
                    data-edit-chat-profile-id="${profile.id}"
                >
                    Editar
                </button>
            </div>
        </article>
    `;
}
