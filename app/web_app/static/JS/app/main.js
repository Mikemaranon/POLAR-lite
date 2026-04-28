import { bindUI, bootApp, ensureAuthenticated } from "./controller.js";
import { showStatus } from "./status-ui.js";


document.addEventListener("DOMContentLoaded", () => {
    if (!ensureAuthenticated()) {
        return;
    }

    bindUI();
    bootApp().catch((error) => {
        console.error(error);
        showStatus(error.message || "No se pudo inicializar la aplicación.", true);
    });
});
