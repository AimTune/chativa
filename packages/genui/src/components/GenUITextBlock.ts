import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * `<genui-text-block>` — built-in plain-text/markdown chunk renderer.
 * Used automatically by GenUIMessage for `{ type: "text" }` chunks.
 */
@customElement("genui-text-block")
export class GenUITextBlock extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .content {
      font-size: 0.875rem;
      line-height: 1.65;
      color: #0f172a;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;

  @property({ type: String }) content = "";

  override render() {
    return html`<div class="content">${this.content}</div>`;
  }
}
