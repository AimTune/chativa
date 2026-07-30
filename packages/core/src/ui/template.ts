/**
 * The tiny template language backend-authored GenUI components are written in.
 *
 * A server-registered component ships markup, not code, so it needs just enough
 * templating to be useful without becoming an expression evaluator on the
 * client. Deliberately a strict subset — no arbitrary JS, no property calls, no
 * filters:
 *
 * - `{{path.to.value}}` — HTML-escaped interpolation
 * - `{{#if path}} … {{else}} … {{/if}}` — truthiness (empty string/array/0 is false)
 * - `{{#each path}} … {{/each}}` — iteration, with `{{this}}`, `{{this.field}}`,
 *   `{{@index}}`, and parent scope still reachable by name
 *
 * Everything is escaped, so a value can never inject markup; the output is then
 * sanitized again by `<chativa-html>` before it reaches the DOM.
 */

/** Escape a value for safe use in both text and attribute positions. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── AST ───────────────────────────────────────────────────────────────────────

interface TextNode { kind: "text"; value: string }
interface VarNode { kind: "var"; path: string }
interface IfNode { kind: "if"; path: string; then: Node[]; else: Node[] }
interface EachNode { kind: "each"; path: string; body: Node[] }
type Node = TextNode | VarNode | IfNode | EachNode;

/** Lexical scope chain — an `each` body can still see the props above it. */
interface Scope {
  data: unknown;
  index?: number;
  parent?: Scope;
}

const TAG = /\{\{\s*([#/]?)([^}]*?)\s*\}\}/g;

function parse(template: string): Node[] {
  const root: Node[] = [];
  // Each frame is the list new nodes go into, plus what closes it.
  const stack: { nodes: Node[]; block?: IfNode | EachNode }[] = [{ nodes: root }];
  let last = 0;

  const push = (node: Node) => stack[stack.length - 1]!.nodes.push(node);
  const text = (value: string) => { if (value) push({ kind: "text", value }); };

  TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG.exec(template)) !== null) {
    text(template.slice(last, m.index));
    last = m.index + m[0].length;

    const sigil = m[1];
    const body = m[2]!.trim();

    if (sigil === "#") {
      const [keyword, ...rest] = body.split(/\s+/);
      const path = rest.join(" ").trim();
      if (keyword === "if") {
        const node: IfNode = { kind: "if", path, then: [], else: [] };
        push(node);
        stack.push({ nodes: node.then, block: node });
      } else if (keyword === "each") {
        const node: EachNode = { kind: "each", path, body: [] };
        push(node);
        stack.push({ nodes: node.body, block: node });
      } else {
        // Unknown block keyword: keep the literal so the mistake is visible
        // in the rendered widget instead of silently vanishing.
        text(m[0]);
      }
      continue;
    }

    if (sigil === "/") {
      // Closing tag — only pop when there is a block to close, so a stray
      // `{{/if}}` can't unwind past the root.
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (body === "else") {
      const frame = stack[stack.length - 1];
      if (frame?.block?.kind === "if") {
        stack[stack.length - 1] = { nodes: frame.block.else, block: frame.block };
      }
      continue;
    }

    push({ kind: "var", path: body });
  }

  text(template.slice(last));
  return root;
}

/** Walk a dotted path from the innermost scope outwards. */
function resolve(path: string, scope: Scope): unknown {
  if (!path) return undefined;
  if (path === "@index") {
    for (let s: Scope | undefined = scope; s; s = s.parent) {
      if (s.index !== undefined) return s.index;
    }
    return undefined;
  }
  if (path === "this" || path === ".") return scope.data;

  const segments = path.replace(/^this\./, "").split(".");
  for (let s: Scope | undefined = scope; s; s = s.parent) {
    let current: unknown = s.data;
    let ok = true;
    for (const segment of segments) {
      if (current === null || current === undefined || typeof current !== "object") { ok = false; break; }
      if (!(segment in (current as Record<string, unknown>))) { ok = false; break; }
      current = (current as Record<string, unknown>)[segment];
    }
    if (ok) return current;
  }
  return undefined;
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function renderNodes(nodes: Node[], scope: Scope): string {
  let out = "";
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += node.value;
        break;
      case "var":
        out += escapeHtml(resolve(node.path, scope));
        break;
      case "if":
        out += renderNodes(truthy(resolve(node.path, scope)) ? node.then : node.else, scope);
        break;
      case "each": {
        const list = resolve(node.path, scope);
        if (!Array.isArray(list)) break;
        list.forEach((item, index) => {
          out += renderNodes(node.body, { data: item, index, parent: scope });
        });
        break;
      }
    }
  }
  return out;
}

/**
 * Render a component template against its props.
 *
 * Never throws: an unknown path renders as an empty string, an unbalanced block
 * closes at the end of the template. A broken widget is a bad look; a crash
 * inside a chat bubble is worse.
 */
export function renderTemplate(template: string, props: Record<string, unknown>): string {
  if (!template) return "";
  return renderNodes(parse(template), { data: props });
}
