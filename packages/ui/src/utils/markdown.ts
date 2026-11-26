import { marked } from "marked";

const CODE_SPAN_PATTERN = /(`+)([\s\S]*?)\1/g;
const NUMERIC_ASTERISK_PATTERN = /(\d)\*(?=\d)/g;

function escapeNumericAsterisks(text: string): string {
  return text.replace(NUMERIC_ASTERISK_PATTERN, "$1\\*");
}

function preserveNumericAsterisks(markdown: string): string {
  if (!/\d\*\d/.test(markdown)) return markdown;

  let output = "";
  let cursor = 0;
  for (const match of markdown.matchAll(CODE_SPAN_PATTERN)) {
    const start = match.index ?? cursor;
    output += escapeNumericAsterisks(markdown.slice(cursor, start));
    output += match[0];
    cursor = start + match[0].length;
  }

  return output + escapeNumericAsterisks(markdown.slice(cursor));
}

export function renderMarkdown(markdown: string): string {
  return marked.parse(preserveNumericAsterisks(markdown), { async: false }) as string;
}
