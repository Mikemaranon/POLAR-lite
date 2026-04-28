import { renderAll } from "./render.js";

const appCallbacks = {
    onConversationDelete: null,
    onConversationSelect: null,
    onProjectSelect: null,
};


export function configureAppCallbacks(callbacks = {}) {
    Object.assign(appCallbacks, callbacks);
}


export function getAppCallbacks() {
    return appCallbacks;
}


export function renderApp() {
    renderAll(appCallbacks);
}
