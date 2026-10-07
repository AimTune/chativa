/**
 * IMessageAction — Port definition for custom per-message actions
 * ("Share", "Report", "Translate" …) shown in the message action bar next to
 * the built-in copy / regenerate / edit buttons.
 *
 * No external dependencies allowed in this file.
 */

import type { IncomingMessage } from "../entities/Message";

export type MessageActionSender = "bot" | "user";

export interface MessageActionContext {
  /** The message the action bar belongs to. */
  message: IncomingMessage;
  /** Who sent it. */
  sender: MessageActionSender;
  /**
   * True on the latest bot reply (for bot messages) or the latest user
   * message (for user messages) — the ones regenerate / edit apply to.
   */
  isLatest: boolean;
}

export interface IMessageAction {
  /** Unique identifier; registering the same name again replaces the action. */
  readonly name: string;
  /**
   * Accessible label (button `aria-label` and tooltip).
   * Pass a function for lazy i18n evaluation at render time:
   *   `label: () => t("actions.share")`
   */
  readonly label: string | (() => string);
  /**
   * Per-locale labels, keyed by language code: `{ en: "Share", tr: "Paylaş" }`.
   * The widget picks the active language — exact match first (`"pt-BR"`),
   * then its base language (`"pt"`) — and falls back to `label` when neither
   * is listed. Re-evaluated on every render, so language switches apply live.
   */
  readonly translations?: Readonly<Record<string, string>>;
  /**
   * The button's glyph. Either an emoji / short text (`"📤"`), shown as is,
   * or inner SVG markup (`<path d="..."/>`, anything starting with `<`)
   * rendered inside chativa's own 24×24 `<svg>` wrapper with `fill`/`stroke`
   * set to `currentColor` — do not include an outer `<svg>` tag.
   * Omit to show the label as text.
   */
  readonly icon?: string;
  /**
   * Where the action shows: `"menu"` puts it in the "⋮" overflow menu at the
   * end of the action bar (label + icon), `"inline"` pins it to the bar as an
   * icon button next to copy / regenerate / edit. Default: `"menu"`.
   */
  readonly placement?: "inline" | "menu";
  /**
   * Which senders' messages get the action: one sender, a list of senders,
   * or `"all"`. Default: `"bot"`.
   */
  readonly appliesTo?: MessageActionSender | "all" | readonly MessageActionSender[];
  /** Senders whose messages never get the action. Wins over `appliesTo`. */
  readonly excludeSenders?: readonly MessageActionSender[];
  /**
   * Only messages of these types (`IncomingMessage.type`: `"text"`, `"card"`,
   * `"genui"`, a custom renderer's type …). Omit for every type.
   */
  readonly messageTypes?: readonly string[];
  /** Message types that never get the action. Wins over `messageTypes`. */
  readonly excludeMessageTypes?: readonly string[];
  /** Sort key; lower renders first. Built-in actions come before all custom ones. Default: `0`. */
  readonly order?: number;
  /**
   * Optional per-message filter, checked after the sender and type filters —
   * return false to hide the action on this message.
   */
  isVisible?(context: MessageActionContext): boolean;
  /** Called when the user activates the action. */
  execute(context: MessageActionContext): void | Promise<void>;
}

/**
 * Whether `action` applies to a message from `sender` of type `messageType`,
 * by its declarative filters (`appliesTo`, `excludeSenders`, `messageTypes`,
 * `excludeMessageTypes`). `isVisible` is not consulted here.
 */
export function messageActionMatches(
  action: IMessageAction,
  sender: MessageActionSender,
  messageType: string,
): boolean {
  const target = action.appliesTo ?? "bot";
  const senders: readonly string[] =
    target === "all" ? [sender] : typeof target === "string" ? [target] : target;
  if (!senders.includes(sender)) return false;
  if (action.excludeSenders?.includes(sender)) return false;
  if (action.messageTypes && !action.messageTypes.includes(messageType)) return false;
  if (action.excludeMessageTypes?.includes(messageType)) return false;
  return true;
}

/**
 * The label to show for `action` in `language`: `translations[language]`,
 * then `translations[<base language>]`, then `label` (calling it when it is
 * a function).
 */
export function resolveMessageActionLabel(action: IMessageAction, language: string | undefined): string {
  const translations = action.translations;
  if (translations && language) {
    const exact = translations[language];
    if (exact) return exact;
    const base = translations[language.split("-")[0]];
    if (base) return base;
  }
  return typeof action.label === "function" ? action.label() : action.label;
}
