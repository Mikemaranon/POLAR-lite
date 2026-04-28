import { elements } from "./dom.js";
import { escapeHtml } from "./html.js";
import { renderMarkdown } from "./markdown.js";
import { state } from "./state.js";

const MESSAGES_AUTO_SCROLL_THRESHOLD = 24;


export function createMessageMarkup(role, content) {
    const isUser = role === "user";
    const roleLabel = isUser ? "Tú" : "Asistente";
    const avatar = isUser ? "YOU" : "AI";
    const contentClass = isUser ? "message__content--plain" : "message__content--markdown";
    const renderedContent = isUser
        ? escapeHtml(content || "")
        : renderMarkdown(content || "");

    return `
        <article class="message message--${isUser ? "user" : "assistant"}">
            <div class="message__avatar">${avatar}</div>
            <div class="message__card">
                <div class="message__meta">${roleLabel}</div>
                <div class="message__content ${contentClass}" data-message-content="true">${renderedContent}</div>
            </div>
        </article>
    `;
}


export function isMessagesContainerNearBottom() {
    const container = elements.messagesContainer;

    if (!container || container.hidden) {
        return true;
    }

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= MESSAGES_AUTO_SCROLL_THRESHOLD;
}


export function scrollMessagesToBottom() {
    if (!elements.messagesContainer) {
        return;
    }

    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}


export function enableMessagesAutoScroll() {
    state.messagesAutoScrollEnabled = true;
}


export function disableMessagesAutoScroll() {
    state.messagesAutoScrollEnabled = false;
}


export function syncMessagesAutoScrollState() {
    state.messagesAutoScrollEnabled = isMessagesContainerNearBottom();
}


export function keepMessagesPinnedToBottomIfNeeded() {
    if (!state.messagesAutoScrollEnabled) {
        return;
    }

    scrollMessagesToBottom();
}


export function appendTypingMessage() {
    elements.emptyState.hidden = true;
    elements.messagesContainer.hidden = false;
    elements.messagesContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="message message--assistant" data-typing-message="true">
                <div class="message__avatar">AI</div>
                <div class="message__card">
                    <div class="message__meta">Asistente</div>
                    <div class="typing-indicator"><span></span><span></span><span></span></div>
                </div>
            </div>
        `
    );
    keepMessagesPinnedToBottomIfNeeded();
}


export function removeTypingMessage() {
    document.querySelector("[data-typing-message='true']")?.remove();
}


export function appendStreamingAssistantMessage() {
    elements.emptyState.hidden = true;
    elements.messagesContainer.hidden = false;
    elements.messagesContainer.insertAdjacentHTML(
        "beforeend",
        `
            <article class="message message--assistant" data-streaming-message="true">
                <div class="message__avatar">AI</div>
                <div class="message__card">
                    <div class="message__meta">Asistente</div>
                    <div class="message__content message__content--markdown" data-message-content="true"></div>
                </div>
            </article>
        `
    );
    keepMessagesPinnedToBottomIfNeeded();
}


export function updateStreamingAssistantMessage(content) {
    const contentNode = document.querySelector(
        "[data-streaming-message='true'] [data-message-content='true']"
    );

    if (!contentNode) {
        return;
    }

    contentNode.innerHTML = renderMarkdown(content || "");
    keepMessagesPinnedToBottomIfNeeded();
}


export function finalizeStreamingAssistantMessage(content) {
    const streamingNode = document.querySelector("[data-streaming-message='true']");
    if (!streamingNode) {
        return;
    }

    updateStreamingAssistantMessage(content);
    streamingNode.removeAttribute("data-streaming-message");
}


export function removeStreamingAssistantMessage() {
    document.querySelector("[data-streaming-message='true']")?.remove();
}
