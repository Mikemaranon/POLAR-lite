import assert from "node:assert/strict";

const markdownModuleUrl = new URL("../../app/web_app/static/JS/app/markdown.js", import.meta.url);
const { renderMarkdown } = await import(markdownModuleUrl);

assert.equal(
    renderMarkdown("hola `x`"),
    "<p>hola <code>x</code></p>",
    "single inline code span should render normally"
);

assert.equal(
    renderMarkdown("hola `x"),
    "<p>hola `x</p>",
    "unmatched opening backtick should stay as literal text"
);

assert.equal(
    renderMarkdown("``const `value` = 1`` y `otra`"),
    "<p><code>const `value` = 1</code> y <code>otra</code></p>",
    "multi-backtick fences should only close with the same fence length"
);

assert.equal(
    renderMarkdown("En el ejemplo, pasamos `y` (que apunta a `x`) a incrementa, y dentro de la función, `*p` se usa."),
    "<p>En el ejemplo, pasamos <code>y</code> (que apunta a <code>x</code>) a incrementa, y dentro de la función, <code>*p</code> se usa.</p>",
    "isolated inline code spans should not merge into a longer broken span"
);

console.log("Markdown inline code tests passed.");
