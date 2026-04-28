import { delete_token, getToken, loadPage, send_API_request } from "../../SERVER_CONN/token-handler.js";


export function ensureAuthenticated() {
    if (!getToken()) {
        window.location.href = "/login";
        return false;
    }

    return true;
}


export async function handleLogout() {
    try {
        await send_API_request("POST", "/logout");
    } catch (error) {
        console.warn("Logout server call failed:", error);
    }

    delete_token();
    loadPage("/login");
}
