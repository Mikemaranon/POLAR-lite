import { bindUI, bootApp, ensureAuthenticated } from "./controller.js";
import { showStatus } from "./utils.js";


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
