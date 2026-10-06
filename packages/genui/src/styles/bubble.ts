import { css } from "lit";

/**
 * Shared chat-bubble look for text content inside GenUI streams.
 *
 * Apply the `chativa-bubble` class to the element that holds the text.
 * Used by the built-in text chunk renderer and `<genui-text-block>`; custom
 * components can opt in the same way:
 *
 * ```ts
 * import { bubbleStyles } from "@chativa/genui";
 *
 * class MyComponent extends ChativaElement {
 *   static styles = [bubbleStyles, css`...`];
 *   render() { return html`<div class="chativa-bubble">${this.text}</div>`; }
 * }
 * ```
 *
 * The font follows the widget: `--chativa-font-family` overrides it
 * globally, and a component can override just itself by re-declaring
 * `font-family` after these styles.
 */
export const bubbleStyles = css`
  .chativa-bubble {
    background: #f1f5f9;
    color: #0f172a;
    /* Logical corners: the "tail" corner sits at the inline-start, top
       edge — top-left in LTR, top-right in RTL. */
    border-radius: 16px;
    border-start-start-radius: 4px;
    padding: 9px 13px;
    /* Each line picks its own base direction from its first strong
       character, so mixed Arabic/English text keeps its punctuation in
       place without changing the bubble's own (widget) direction. */
    unicode-bidi: plaintext;
    font-family: var(--chativa-font-family, inherit);
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    width: fit-content;
    max-width: 100%;
    box-sizing: border-box;
  }
`;
