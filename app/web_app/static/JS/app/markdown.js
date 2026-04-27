function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}


export function renderMarkdown(content) {
    const normalized = String(content || "").replace(/\r\n?/g, "\n");
    const lines = normalized.split("\n");
    return renderMarkdownBlocks(lines);
}


function renderMarkdownBlocks(lines) {
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];

        if (!line.trim()) {
            index += 1;
            continue;
        }

        const fencedCodeBlock = parseFencedCodeBlock(lines, index);
        if (fencedCodeBlock) {
            blocks.push(fencedCodeBlock.html);
            index = fencedCodeBlock.nextIndex;
            continue;
        }

        const atxHeading = parseAtxHeading(line);
        if (atxHeading) {
            blocks.push(atxHeading);
            index += 1;
            continue;
        }

        const setextHeading = parseSetextHeading(lines, index);
        if (setextHeading) {
            blocks.push(setextHeading.html);
            index = setextHeading.nextIndex;
            continue;
        }

        if (isHorizontalRule(line)) {
            blocks.push("<hr>");
            index += 1;
            continue;
        }

        if (isTableStart(lines, index)) {
            const table = parseTable(lines, index);
            blocks.push(table.html);
            index = table.nextIndex;
            continue;
        }

        if (isBlockquoteLine(line)) {
            const blockquote = parseBlockquote(lines, index);
            blocks.push(blockquote.html);
            index = blockquote.nextIndex;
            continue;
        }

        if (getListMarker(line)) {
            const list = parseList(lines, index);
            blocks.push(list.html);
            index = list.nextIndex;
            continue;
        }

        const paragraph = parseParagraph(lines, index);
        blocks.push(paragraph.html);
        index = paragraph.nextIndex;
    }

    return blocks.join("");
}


function parseFencedCodeBlock(lines, startIndex) {
    const openingLine = lines[startIndex];
    const openingMatch = openingLine.match(/^\s*([`~]{3,})(.*)$/);
    if (!openingMatch) {
        return null;
    }

    const fence = openingMatch[1];
    const fenceChar = fence[0];
    const fenceLength = fence.length;
    const infoString = String(openingMatch[2] || "").trim();
    const language = infoString.split(/\s+/)[0] || "";
    const codeLines = [];
    let index = startIndex + 1;

    while (index < lines.length) {
        const line = lines[index];
        const closingRegex = new RegExp(`^\\s*\\${fenceChar}{${fenceLength},}\\s*$`);
        if (closingRegex.test(line)) {
            return {
                html: renderCodeBlock(codeLines.join("\n"), language),
                nextIndex: index + 1,
            };
        }

        codeLines.push(line);
        index += 1;
    }

    return {
        html: renderCodeBlock(codeLines.join("\n"), language),
        nextIndex: lines.length,
    };
}


function parseAtxHeading(line) {
    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) {
        return "";
    }

    const level = match[1].length;
    return `<h${level}>${renderInlineMarkdown(match[2].trim())}</h${level}>`;
}


function parseSetextHeading(lines, startIndex) {
    if (startIndex + 1 >= lines.length) {
        return null;
    }

    const title = lines[startIndex].trim();
    const underline = lines[startIndex + 1].trim();

    if (!title) {
        return null;
    }

    if (/^=+\s*$/.test(underline)) {
        return {
            html: `<h1>${renderInlineMarkdown(title)}</h1>`,
            nextIndex: startIndex + 2,
        };
    }

    if (/^-+\s*$/.test(underline)) {
        return {
            html: `<h2>${renderInlineMarkdown(title)}</h2>`,
            nextIndex: startIndex + 2,
        };
    }

    return null;
}


function isHorizontalRule(line) {
    return /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line);
}


function isBlockquoteLine(line) {
    return /^\s{0,3}>\s?/.test(line);
}


function parseBlockquote(lines, startIndex) {
    const quoteLines = [];
    let index = startIndex;

    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
            quoteLines.push("");
            index += 1;
            continue;
        }
        if (!isBlockquoteLine(line)) {
            break;
        }

        quoteLines.push(line.replace(/^\s{0,3}>\s?/, ""));
        index += 1;
    }

    return {
        html: `<blockquote>${renderMarkdownBlocks(quoteLines)}</blockquote>`,
        nextIndex: index,
    };
}


function parseList(lines, startIndex) {
    const firstMarker = getListMarker(lines[startIndex]);
    const listTag = firstMarker.type;
    const baseIndent = firstMarker.indent;
    const items = [];
    let index = startIndex;

    while (index < lines.length) {
        const marker = getListMarker(lines[index]);
        if (!marker || marker.type !== listTag || marker.indent !== baseIndent) {
            break;
        }

        const itemLines = [marker.content];
        index += 1;

        while (index < lines.length) {
            const nextLine = lines[index];
            if (!nextLine.trim()) {
                const nextNonEmptyIndex = findNextNonEmptyLineIndex(lines, index + 1);
                if (nextNonEmptyIndex === -1) {
                    index = lines.length;
                    break;
                }

                const nextNonEmptyLine = lines[nextNonEmptyIndex];
                const nextMarker = getListMarker(nextNonEmptyLine);
                const nextIndent = countIndent(nextNonEmptyLine);

                if (
                    (nextMarker && nextMarker.indent === baseIndent && nextMarker.type === listTag)
                    || nextIndent > baseIndent
                ) {
                    itemLines.push("");
                    index = nextNonEmptyIndex;
                    continue;
                }

                index = nextNonEmptyIndex;
                break;
            }

            const nextMarker = getListMarker(nextLine);
            if (nextMarker && nextMarker.indent === baseIndent && nextMarker.type === listTag) {
                break;
            }

            if (nextMarker && nextMarker.indent <= baseIndent && nextMarker.type !== listTag) {
                break;
            }

            if (nextMarker && nextMarker.indent < baseIndent) {
                break;
            }

            itemLines.push(stripIndent(nextLine, baseIndent + marker.contentIndent));
            index += 1;
        }

        items.push(renderListItem(itemLines, marker));
    }

    return {
        html: `<${listTag}>${items.join("")}</${listTag}>`,
        nextIndex: index,
    };
}


function renderListItem(itemLines, marker) {
    const firstLine = itemLines[0] || "";
    const taskMatch = firstLine.match(/^\[( |x|X)\]\s+(.*)$/);
    const contentLines = taskMatch
        ? [taskMatch[2], ...itemLines.slice(1)]
        : itemLines;
    const renderedContent = renderMarkdownBlocks(contentLines);

    if (!taskMatch) {
        return `<li>${renderedContent}</li>`;
    }

    const checked = taskMatch[1].toLowerCase() === "x";
    return `
        <li class="markdown-task-list__item">
            <span class="markdown-task-list__checkbox" aria-hidden="true">${checked ? "✓" : ""}</span>
            <div class="markdown-task-list__content">${renderedContent}</div>
        </li>
    `;
}


function getListMarker(line) {
    const match = line.match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
    if (!match) {
        return null;
    }

    const indent = match[1].replace(/\t/g, "    ").length;
    const marker = match[2];
    return {
        type: /^\d/.test(marker) ? "ol" : "ul",
        indent,
        contentIndent: marker.length + 1,
        content: match[3],
    };
}


function stripIndent(line, indent) {
    let remaining = indent;
    let index = 0;

    while (remaining > 0 && index < line.length) {
        if (line[index] === " ") {
            remaining -= 1;
        } else if (line[index] === "\t") {
            remaining -= 4;
        } else {
            break;
        }
        index += 1;
    }

    return line.slice(index);
}


function countIndent(line) {
    return String(line || "").match(/^\s*/)?.[0].replace(/\t/g, "    ").length || 0;
}


function findNextNonEmptyLineIndex(lines, startIndex) {
    let index = startIndex;

    while (index < lines.length) {
        if (lines[index].trim()) {
            return index;
        }
        index += 1;
    }

    return -1;
}


function isTableStart(lines, startIndex) {
    if (startIndex + 1 >= lines.length) {
        return false;
    }

    const headerCells = splitTableRow(lines[startIndex]);
    const separatorCells = splitTableRow(lines[startIndex + 1]);

    if (headerCells.length < 2 || headerCells.length !== separatorCells.length) {
        return false;
    }

    return separatorCells.every((cell) => /^:?-{1,}:?$/.test(cell));
}


function parseTable(lines, startIndex) {
    const headerCells = splitTableRow(lines[startIndex]);
    const separatorCells = splitTableRow(lines[startIndex + 1]);
    const alignments = separatorCells.map((cell) => {
        const left = cell.startsWith(":");
        const right = cell.endsWith(":");

        if (left && right) {
            return "center";
        }
        if (right) {
            return "right";
        }
        if (left) {
            return "left";
        }
        return "";
    });

    const rows = [];
    let index = startIndex + 2;

    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim() || !line.includes("|")) {
            break;
        }

        rows.push(normalizeTableRow(splitTableRow(line), headerCells.length));
        index += 1;
    }

    const headerMarkup = headerCells.map((cell, cellIndex) => renderTableCell("th", cell, alignments[cellIndex])).join("");
    const bodyMarkup = rows.length
        ? `<tbody>${rows.map((row) => `<tr>${row.map((cell, cellIndex) => renderTableCell("td", cell, alignments[cellIndex])).join("")}</tr>`).join("")}</tbody>`
        : "";

    return {
        html: `
            <div class="message-table-scroll">
                <table>
                    <thead><tr>${headerMarkup}</tr></thead>
                    ${bodyMarkup}
                </table>
            </div>
        `,
        nextIndex: index,
    };
}


function splitTableRow(line) {
    const trimmed = String(line || "").trim();
    const normalized = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
    const content = normalized.endsWith("|") ? normalized.slice(0, -1) : normalized;
    return content.split("|").map((cell) => cell.trim());
}


function normalizeTableRow(cells, expectedLength) {
    const normalized = cells.slice(0, expectedLength);
    while (normalized.length < expectedLength) {
        normalized.push("");
    }
    return normalized;
}


function renderTableCell(tagName, content, alignment) {
    const alignmentAttribute = alignment ? ` style="text-align:${alignment}"` : "";
    return `<${tagName}${alignmentAttribute}>${renderInlineMarkdown(content)}</${tagName}>`;
}


function parseParagraph(lines, startIndex) {
    const paragraphLines = [];
    let index = startIndex;

    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
            break;
        }
        if (parseFencedCodeBlock(lines, index)) {
            break;
        }
        if (parseAtxHeading(line) || isHorizontalRule(line) || isBlockquoteLine(line) || getListMarker(line) || isTableStart(lines, index)) {
            break;
        }

        paragraphLines.push(line);
        index += 1;
    }

    return {
        html: `<p>${renderInlineMarkdown(paragraphLines.join("\n")).replace(/\n/g, "<br>")}</p>`,
        nextIndex: index,
    };
}


function renderInlineMarkdown(content) {
    const tokens = [];
    let text = String(content || "");

    text = replaceWithTokens(text, /(`+)([^`\n](?:[\s\S]*?[^`\n])?)\1/g, (match, _, code) => {
        return preserveToken(tokens, `<code>${escapeHtml(code)}</code>`);
    });

    text = replaceWithTokens(text, /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, alt, url) => {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) {
            return preserveToken(tokens, escapeHtml(match));
        }

        return preserveToken(
            tokens,
            `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}" loading="lazy">`
        );
    });

    text = replaceWithTokens(text, /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, label, url) => {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) {
            return preserveToken(tokens, escapeHtml(label));
        }

        return preserveToken(
            tokens,
            `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`
        );
    });

    text = replaceWithTokens(text, /<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (match, url) => {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) {
            return preserveToken(tokens, escapeHtml(match));
        }

        return preserveToken(
            tokens,
            `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(url)}</a>`
        );
    });

    text = replaceWithTokens(text, /\bhttps?:\/\/[^\s<]+[^\s<.,!?;:)]/g, (match) => {
        const safeUrl = sanitizeUrl(match);
        if (!safeUrl) {
            return preserveToken(tokens, escapeHtml(match));
        }

        return preserveToken(
            tokens,
            `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(match)}</a>`
        );
    });

    text = escapeHtml(text)
        .replace(/(\*\*\*|___)(.+?)\1/g, "<strong><em>$2</em></strong>")
        .replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>")
        .replace(/~~(.+?)~~/g, "<del>$1</del>")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
        .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");

    tokens.forEach((token, index) => {
        text = text.replace(`%%TOKEN${index}%%`, token);
    });

    return text;
}


function replaceWithTokens(text, pattern, replacer) {
    return text.replace(pattern, (...args) => replacer(...args));
}


function preserveToken(tokens, html) {
    const token = `%%TOKEN${tokens.length}%%`;
    tokens.push(html);
    return token;
}


function renderCodeBlock(content, language) {
    const normalizedLanguage = String(language || "").trim();
    const languageSlug = slugifyLanguage(normalizedLanguage);
    const languageClass = languageSlug ? ` language-${languageSlug}` : "";
    const languageAttribute = languageSlug ? ` data-language="${escapeHtml(languageSlug)}"` : "";
    const labelMarkup = normalizedLanguage
        ? `<div class="message-code-block__label">${escapeHtml(normalizedLanguage)}</div>`
        : "";

    return `
        <div class="message-code-block"${languageAttribute}>
            ${labelMarkup}
            <pre class="message-code-block__pre"><code class="message-code-block__code${languageClass}">${escapeHtml(content)}</code></pre>
        </div>
    `;
}


function slugifyLanguage(language) {
    return String(language || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9#+.-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function sanitizeUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
        return "";
    }

    try {
        const parsed = new URL(value, "https://example.invalid");
        if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
            return parsed.href;
        }
    } catch {
        return "";
    }

    return "";
}
