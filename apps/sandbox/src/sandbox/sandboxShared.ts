import { css } from "lit";
import { chatStore } from "@chativa/core";

/** Shared Lit CSS for all sandbox section components. */
export const sectionStyles = css`
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
  }

  /* ── Accordion header ── */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    padding: 4px 0;
    user-select: none;
    -webkit-user-select: none;
  }

  .section-label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #94a3b8;
    transition: color 0.15s;
  }

  .section-header:hover .section-label { color: #64748b; }

  .chevron {
    color: #cbd5e1;
    transition: transform 0.2s ease, color 0.15s;
    flex-shrink: 0;
  }
  .chevron.open { transform: rotate(180deg); }
  .section-header:hover .chevron { color: #94a3b8; }

  /* ── Content wrapper ── */
  .section-body { padding-top: 8px; }

  /* ── Sub-label (inside an open section) ── */
  .sub-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 6px;
  }

  /* ── Toggle group ── */
  .toggle-group {
    display: flex;
    gap: 3px;
    background: #f1f5f9;
    border-radius: 9px;
    padding: 3px;
  }

  .tg-btn {
    flex: 1;
    padding: 6px 4px;
    border: none;
    border-radius: 7px;
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .tg-btn:hover { color: #0f172a; }
  .tg-btn.active {
    background: white;
    color: #4f46e5;
    font-weight: 600;
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.09);
  }

  /* ── Demo button grid ── */
  .msg-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .msg-btn {
    padding: 7px 6px;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    font-size: 0.75rem;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    text-align: center;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .msg-btn:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }

  /* ── Action buttons ── */
  .actions { display: flex; gap: 8px; }

  .btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 9px;
    border: none;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    font-family: inherit;
  }
  .btn:hover { opacity: 0.88; }
  .btn:active { transform: scale(0.96); }
  .btn-primary { background: #4f46e5; color: white; }
  .btn-ghost { background: #f1f5f9; color: #475569; }
`;

/** Chevron SVG for accordion headers. */
export const chevronSvg = (open: boolean) =>
  `<svg class="chevron ${open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

/** Inject a demo message. Opens the widget if closed. */
export function injectMessage(msg: Record<string, unknown>) {
  const fn = (window as unknown as Record<string, unknown>).chativaInject as
    | ((m: Record<string, unknown>) => void)
    | undefined;
  if (!fn) return;
  if (!chatStore.getState().isOpened) chatStore.getState().toggle();
  fn(msg);
}

/** Trigger a GenUI demo stream. Opens the widget if closed. */
export function triggerGenUI(command: string) {
  const fn = (window as unknown as Record<string, unknown>).chativaGenUI as
    | ((cmd: string) => void)
    | undefined;
  if (!fn) return;
  if (!chatStore.getState().isOpened) chatStore.getState().toggle();
  fn(command);
}
