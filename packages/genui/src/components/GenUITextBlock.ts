import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";
import { bubbleStyles } from "../styles/bubble";

/**
 * `<genui-text-block>` — built-in plain-text chunk renderer, drawn as a
 * regular bot bubble. Available to connectors as `genui-text` and to
 * custom components for composing text into their own templates.
 */
@customElement("genui-text-block")
export class GenUITextBlock extends ChativaElement {
  static override styles = [
    bubbleStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ type: String }) content = "";

  override render() {
    return html`<div class="chativa-bubble">${this.content}</div>`;
  }
}
