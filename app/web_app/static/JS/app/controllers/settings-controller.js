import { persistSetting } from "../api.js";
import { applyModelsPayload, applySettingsPayload } from "../state-actions.js";
import { loadModels, loadSettings } from "../store.js";
import { readCloudApiKeyMap, getSelectedCloudProvider } from "../provider-helpers.js";
import { elements } from "../dom.js";
import { populateSettingsForm, renderProviderControls } from "../render.js";
import { syncComposerAvailability } from "../composer-ui.js";
import { showStatus } from "../status-ui.js";
import { state } from "../state.js";


export async function handleSettingsSubmit(event) {
    event.preventDefault();

    const provider = getSelectedCloudProvider();

    try {
        const existingCloudKeys = readCloudApiKeyMap(state.settings.openai_api_key);

        const apiKey = elements.openaiApiKeyInput.value.trim();
        if (apiKey) {
            existingCloudKeys[provider] = apiKey;
        } else {
            delete existingCloudKeys[provider];
        }

        await persistSetting("openai_api_key", JSON.stringify(existingCloudKeys));

        applySettingsPayload(await loadSettings());
        applyModelsPayload(await loadModels());
        renderProviderControls();
        populateSettingsForm();
        syncComposerAvailability();
    } catch (error) {
        showStatus(error.message || "No se pudieron guardar los ajustes.", true);
    }
}
