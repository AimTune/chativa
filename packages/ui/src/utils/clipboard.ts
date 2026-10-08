import { marked } from "marked";

/**
 * Write text to the clipboard. Uses the async Clipboard API when the page is
 * allowed to, otherwise falls back to a hidden textarea + `execCommand("copy")`
 * (older browsers, insecure origins, some embedded webviews).
 * Resolves whether the copy succeeded.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission denied or not focused — try the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.("copy") ?? false;
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Blocks followed by a blank line, and blocks followed by a single line break. */
const PARAGRAPH_BLOCKS = "p,pre,h1,h2,h3,h4,h5,h6,blockquote,table";
const LINE_BLOCKS = "li,tr";

/**
 * Turn a Markdown message into the plain text a user expects to paste:
 * no `**`, backticks or link syntax; paragraphs separated by a blank line,
 * list items and table rows one per line.
 * Parsed in an inert DOMParser document so nothing in the markup loads or runs.
 */
export function markdownToPlainText(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Drop the formatting newlines marked puts between block tags (outside code)
  // — the block pass below adds exactly one line break per block instead.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const blank: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() && n.textContent?.includes("\n") && !n.parentElement?.closest("pre")) {
      blank.push(n as Text);
    }
  }
  blank.forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll(LINE_BLOCKS).forEach((el) => el.append("\n"));
  doc.querySelectorAll(PARAGRAPH_BLOCKS).forEach((el) => el.append("\n\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
