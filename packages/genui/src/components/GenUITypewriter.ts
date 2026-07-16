import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";
import { bubbleStyles } from "../styles/bubble";

/**
 * GenUITypewriter — animates text content character by character.
 *
 * Registered as "genui-typewriter" in GenUIRegistry.
 *
 * @example (AIChunk)
 * ```json
 * { "type": "ui", "component": "genui-typewriter", "props": {
 *   "content": "Hello! How can I help you today?",
 *   "speed": 30
 * }}
 * ```
 */
@customElement("genui-typewriter")
export class GenUITypewriter extends ChativaElement {
  static override styles = [
    bubbleStyles,
    css`
      :host {
        display: block;
      }

      /* The typewriting happens inside a regular bot bubble. Override the
         font per component with --chativa-typewriter-font, or globally
         with --chativa-font-family. */
      .chativa-bubble {
        font-family: var(--chativa-typewriter-font, var(--chativa-font-family, inherit));
      }

      .cursor {
        display: inline-block;
        font-weight: 300;
        animation: blink 1s step-end infinite;
        margin-left: 1px;
        opacity: 1;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0; }
      }
    `,
  ];

  /** Full text to animate. */
  @property({ type: String }) content = "";
  /** Milliseconds between characters. Default: 25. */
  @property({ type: Number }) speed?: number;
  /** Show blinking cursor while animating. Default: true. */
  @property({ type: Boolean }) cursor?: boolean;

  @state() private _displayed = "";

  private _timer: ReturnType<typeof setInterval> | null = null;

  override updated(changed: Map<string, unknown>) {
    if (changed.has("content") || changed.has("speed")) {
      this._restart();
    }
  }

  private _restart() {
    this._clearTimer();
    if (this._displayed.length >= this.content.length) return;
    const ms = this.speed ?? 25;
    this._timer = setInterval(() => {
      const next = this._displayed.length + 1;
      this._displayed = this.content.slice(0, next);
      if (next >= this.content.length) this._clearTimer();
    }, ms);
  }

  private _clearTimer() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._clearTimer();
  }

  override render() {
    const complete = this._displayed.length >= this.content.length;
    const showCursor = this.cursor !== false && !complete;
    return html`<div class="chativa-bubble"><span>${this._displayed}</span>${showCursor ? html`<span class="cursor">|</span>` : nothing}</div>`;
  }
}
