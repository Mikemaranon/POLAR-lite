export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}


export function createEmptyListItem(message) {
    return `<div class="list-item list-item--empty">${escapeHtml(message)}</div>`;
}


export function createMetaChipsMarkup(chips) {
    return chips.map((chip) => `
        <span class="selection-chip selection-chip--static" data-group="${escapeHtml(chip.group)}">
            <span class="selection-chip__group">${escapeHtml(chip.label)}</span>
            <span class="selection-chip__value">${escapeHtml(chip.value)}</span>
        </span>
    `).join("");
}
