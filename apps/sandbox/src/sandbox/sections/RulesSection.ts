import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { chatStore, type AIChunk, type IncomingMessage } from "@chativa/core";
import type { DummyRule } from "@chativa/connector-dummy";
import { sectionStyles } from "../sandboxShared";
import {
  activeDummy,
  buildDummyConnector,
  getDummyOptions,
  setDummyOptions,
  subscribeDummyOptions,
  swapConnector,
} from "../connectorSwap";

type ThenKind = "message" | "genui";

/** Editable, string-typed mirror of a DummyRule. */
interface RuleDraft {
  key: number;
  textMatches: string;
  type: string;
  kind: ThenKind;
  /** JSON: an IncomingMessage (kind "message") or an AIChunk[] (kind "genui"). */
  body: string;
  /** Milliseconds; empty = use replyDelay. */
  delay: string;
}

let _nextKey = 1;

const DEFAULT_MESSAGE_BODY = JSON.stringify(
  { type: "text", from: "bot", data: { text: "Hi there! 👋" } },
  null,
  2,
);

const DEFAULT_GENUI_BODY = JSON.stringify(
  [{ type: "text", content: "Streamed from a rule.", id: 1 }],
  null,
  2,
);

/** The two rules from the issue — a quick way to see the engine working. */
const EXAMPLE_RULES: DummyRule[] = [
  {
    when: { textMatches: "^/(help|yardım)$" },
    then: {
      id: "help-menu",
      type: "buttons",
      from: "bot",
      data: {
        text: "How can I help?",
        buttons: [{ label: "Order status" }, { label: "Talk to a human" }],
      },
    },
  },
  {
    when: { textMatches: "(cancel|iptal)" },
    then: {
      kind: "genui",
      chunks: [
        { type: "text", content: "Sorry to see you go — tell us which order:", id: 1 },
        {
          type: "ui",
          component: "genui-form",
          props: {
            title: "Cancel order",
            buttonText: "Cancel it",
            fields: [{ name: "order", label: "Order number", type: "text", placeholder: "#4821" }],
          },
          id: 2,
        },
      ],
    },
    delay: 300,
  },
];

function toDraft(rule: DummyRule): RuleDraft {
  const then = rule.then;
  const isGenUI = (then as { kind?: string }).kind === "genui";
  return {
    key: _nextKey++,
    textMatches: rule.when?.textMatches ?? "",
    type: rule.when?.type ?? "",
    kind: isGenUI ? "genui" : "message",
    body: JSON.stringify(isGenUI ? (then as { chunks: AIChunk[] }).chunks : then, null, 2),
    delay: rule.delay === undefined ? "" : String(rule.delay),
  };
}

function newDraft(): RuleDraft {
  return {
    key: _nextKey++,
    textMatches: "^hello$",
    type: "",
    kind: "message",
    body: DEFAULT_MESSAGE_BODY,
    delay: "",
  };
}

/** Returns the regex error message, or `null` when the pattern compiles. */
function regexError(pattern: string): string | null {
  if (!pattern) return null;
  try {
    new RegExp(pattern);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Convert a draft into a DummyRule. Throws with a user-facing message. */
function fromDraft(d: RuleDraft, index: number): DummyRule {
  const label = `Rule ${index + 1}`;
  const reErr = regexError(d.textMatches);
  if (reErr) throw new Error(`${label}: invalid regex — ${reErr}`);

  let body: unknown;
  try {
    body = JSON.parse(d.body);
  } catch (err) {
    throw new Error(`${label}: invalid JSON — ${(err as Error).message}`);
  }

  const when: DummyRule["when"] = {};
  if (d.textMatches) when.textMatches = d.textMatches;
  if (d.type.trim()) when.type = d.type.trim();

  let then: DummyRule["then"];
  if (d.kind === "genui") {
    if (!Array.isArray(body)) throw new Error(`${label}: GenUI body must be an array of AIChunk objects.`);
    for (const c of body) {
      if (!isObject(c) || typeof c.type !== "string" || typeof c.id !== "number") {
        throw new Error(`${label}: every chunk needs a string \`type\` and a numeric \`id\`.`);
      }
    }
    then = { kind: "genui", chunks: body as AIChunk[] };
  } else {
    if (!isObject(body) || typeof body.type !== "string" || !isObject(body.data)) {
      throw new Error(`${label}: message body needs a string \`type\` and an object \`data\`.`);
    }
    then = { ...(body as Omit<IncomingMessage, "id">), id: typeof body.id === "string" && body.id ? body.id : `rule-${index + 1}` } as IncomingMessage;
  }

  const rule: DummyRule = { when, then };
  if (d.delay.trim() !== "") {
    const delay = Number(d.delay);
    if (!Number.isInteger(delay) || delay < 0) throw new Error(`${label}: delay must be a non-negative integer.`);
    rule.delay = delay;
  }
  return rule;
}

function isDummyActive(): boolean {
  return !!activeDummy() || !chatStore.getState().activeConnector;
}

@customElement("sandbox-rules-section")
export class RulesSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .stack { display: flex; flex-direction: column; gap: 10px; }

      .hint {
        font-size: 0.6875rem;
        line-height: 1.5;
        color: #64748b;
      }
      .hint code {
        font-family: "SF Mono", "Fira Mono", Menlo, monospace;
        background: #f1f5f9;
        border-radius: 4px;
        padding: 0 3px;
      }

      .rule {
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 8px 10px 10px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .rule-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .rule-title {
        font-size: 0.6875rem;
        font-weight: 700;
        color: #475569;
      }
      .rule-tools { display: flex; gap: 2px; }
      .icon-btn {
        border: none;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 5px;
        font-family: inherit;
      }
      .icon-btn:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
      .icon-btn.danger:hover { background: #fee2e2; color: #b91c1c; }
      .icon-btn:disabled { opacity: 0.35; cursor: default; }

      .field-grid {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 6px 8px;
        align-items: center;
      }
      .field-grid label {
        font-size: 0.6875rem;
        font-weight: 600;
        color: #64748b;
      }
      input[type="text"], input[type="number"], select, textarea {
        width: 100%;
        border: 1.5px solid #e2e8f0;
        border-radius: 6px;
        background: white;
        font-family: "SF Mono", "Fira Mono", Menlo, monospace;
        font-size: 0.75rem;
        color: #0f172a;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.12s;
      }
      input[type="text"], input[type="number"], select { height: 28px; padding: 0 8px; }
      select { font-family: inherit; cursor: pointer; }
      textarea {
        min-height: 92px;
        padding: 6px 8px;
        resize: vertical;
        font-size: 0.6875rem;
        line-height: 1.5;
      }
      input:focus, select:focus, textarea:focus { border-color: #4f46e5; }
      input.invalid { border-color: #f87171; background: #fef2f2; }

      .field-error {
        grid-column: 2;
        font-size: 0.625rem;
        color: #b91c1c;
      }

      .empty {
        font-size: 0.75rem;
        color: #94a3b8;
        text-align: center;
        padding: 12px 0;
        border: 1.5px dashed #e2e8f0;
        border-radius: 10px;
      }

      .apply-btn {
        width: 100%;
        padding: 9px 12px;
        border: none;
        border-radius: 9px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 0.15s, transform 0.15s;
      }
      .apply-btn:hover { opacity: 0.92; }
      .apply-btn:active { transform: scale(0.98); }

      .feedback {
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 6px 9px;
        border-radius: 7px;
        line-height: 1.4;
      }
      .feedback.ok  { background: #dcfce7; color: #166534; }
      .feedback.err { background: #fee2e2; color: #991b1b; }
    `,
  ];

  @state() private _open = true;
  @state() private _drafts: RuleDraft[] = getDummyOptions().rules.map(toDraft);
  @state() private _feedback: { msg: string; ok: boolean } | null = null;

  @state() private _onDummy = isDummyActive();

  private _unsub!: () => void;
  private _unsubStore!: () => void;

  connectedCallback() {
    super.connectedCallback();
    // Rules can also arrive from the Config tab's Import — keep the list in sync.
    this._unsub = subscribeDummyOptions((o) => {
      this._drafts = o.rules.map(toDraft);
    });
    this._unsubStore = chatStore.subscribe(() => {
      this._onDummy = isDummyActive();
    });
  }

  disconnectedCallback() {
    this._unsub?.();
    this._unsubStore?.();
    super.disconnectedCallback();
  }

  private _update(key: number, patch: Partial<RuleDraft>) {
    this._drafts = this._drafts.map((d) => (d.key === key ? { ...d, ...patch } : d));
  }

  private _setKind(key: number, kind: ThenKind) {
    const d = this._drafts.find((x) => x.key === key);
    if (!d || d.kind === kind) return;
    // Swap in a starter body for the new shape — the old JSON would not fit.
    this._update(key, { kind, body: kind === "genui" ? DEFAULT_GENUI_BODY : DEFAULT_MESSAGE_BODY });
  }

  private _move(index: number, dir: -1 | 1) {
    const next = [...this._drafts];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    this._drafts = next;
  }

  private _remove(key: number) {
    this._drafts = this._drafts.filter((d) => d.key !== key);
  }

  /** Validate drafts, store them, and rebuild the DummyConnector. */
  private _apply() {
    this._feedback = null;
    let rules: DummyRule[];
    try {
      rules = this._drafts.map(fromDraft);
    } catch (err) {
      this._feedback = { msg: (err as Error).message, ok: false };
      return;
    }
    // Keep the active dummy's name (if any) so the registry entry is replaced.
    const name = activeDummy()?.name;
    setDummyOptions({ rules });
    swapConnector(buildDummyConnector(name));
    this._feedback = {
      msg: `Applied ${rules.length} rule${rules.length === 1 ? "" : "s"} — DummyConnector rebuilt. Open the widget and try it.`,
      ok: true,
    };
  }

  private _renderRule(d: RuleDraft, i: number) {
    const reErr = regexError(d.textMatches);
    return html`
      <div class="rule">
        <div class="rule-head">
          <span class="rule-title">Rule ${i + 1}</span>
          <span class="rule-tools">
            <button class="icon-btn" title="Move up" ?disabled=${i === 0} @click=${() => this._move(i, -1)}>↑</button>
            <button class="icon-btn" title="Move down" ?disabled=${i === this._drafts.length - 1} @click=${() => this._move(i, 1)}>↓</button>
            <button class="icon-btn danger" title="Remove rule" @click=${() => this._remove(d.key)}>✕</button>
          </span>
        </div>
        <div class="field-grid">
          <label for="re-${d.key}">Text regex</label>
          <input id="re-${d.key}" type="text" class=${reErr ? "invalid" : ""}
            placeholder="(any text)"
            .value=${d.textMatches}
            @input=${(e: Event) => this._update(d.key, { textMatches: (e.target as HTMLInputElement).value })} />
          ${reErr ? html`<span class="field-error">${reErr}</span>` : nothing}

          <label for="type-${d.key}">Msg type</label>
          <input id="type-${d.key}" type="text" placeholder="(any type)"
            .value=${d.type}
            @input=${(e: Event) => this._update(d.key, { type: (e.target as HTMLInputElement).value })} />

          <label for="kind-${d.key}">Respond</label>
          <select id="kind-${d.key}" .value=${d.kind}
            @change=${(e: Event) => this._setKind(d.key, (e.target as HTMLSelectElement).value as ThenKind)}>
            <option value="message">Message (IncomingMessage)</option>
            <option value="genui">GenUI chunks (AIChunk[])</option>
          </select>

          <label for="delay-${d.key}">Delay (ms)</label>
          <input id="delay-${d.key}" type="number" min="0" placeholder="replyDelay"
            .value=${d.delay}
            @input=${(e: Event) => this._update(d.key, { delay: (e.target as HTMLInputElement).value })} />
        </div>
        <textarea
          aria-label="Rule ${i + 1} response JSON"
          spellcheck="false"
          .value=${d.body}
          @input=${(e: Event) => this._update(d.key, { body: (e.target as HTMLTextAreaElement).value })}
        ></textarea>
      </div>
    `;
  }

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Dummy rules</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open
        ? html`
            <div class="section-body stack">
              <div class="hint">
                Script <code>DummyConnector</code> replies without a backend. Rules run top to bottom
                on every message you send; the first match wins, no match falls through to the
                built-in demo commands and the echo.
                ${this._onDummy ? nothing : html`<br /><strong>Apply switches the active connector to Dummy.</strong>`}
              </div>

              ${this._drafts.length
                ? this._drafts.map((d, i) => this._renderRule(d, i))
                : html`<div class="empty">No rules — every message is echoed.</div>`}

              <div class="actions">
                <button class="btn btn-ghost" @click=${() => (this._drafts = [...this._drafts, newDraft()])}>+ Add rule</button>
                <button class="btn btn-ghost" title="Append the two example rules from the docs"
                  @click=${() => (this._drafts = [...this._drafts, ...EXAMPLE_RULES.map(toDraft)])}>Load example</button>
              </div>

              <button class="apply-btn" @click=${() => this._apply()}>Apply</button>

              ${this._feedback
                ? html`<div class="feedback ${this._feedback.ok ? "ok" : "err"}">${this._feedback.msg}</div>`
                : nothing}
            </div>
          `
        : nothing}
    `;
  }
}
