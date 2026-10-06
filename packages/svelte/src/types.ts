import type { Snippet } from "svelte";
import type {
  ConnectorStatus,
  DeepPartial,
  IConnector,
  IExtension,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
  ThemeConfig,
} from "@chativa/core";

export interface ChativaProviderProps {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and activate as the default. */
  connector?: string | IConnector;
  /** Extensions to install once, before any child widget mounts. */
  extensions?: IExtension[];
  /** Theme overrides, deep-merged over the default theme. Reactive — updates (including deep `$state` mutations) re-apply. */
  theme?: DeepPartial<ThemeConfig>;
  /** Initial locale override (e.g. `"tr"`, `"en"`), skipping browser detection. */
  locale?: string;
  /** Flat i18n translation overrides, applied to every registered language — see `ChativaSettings.i18n` in `@chativa/core` for the full per-language format. */
  i18n?: Record<string, unknown>;
  children?: Snippet;
}

export interface ChatIvaProps {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and use. Defaults to whatever `<ChativaProvider>` (or `window.chativaSettings`) has activated. */
  connector?: string | IConnector;
  /**
   * Start in fullscreen and hide the fullscreen toggle. Equivalent to the
   * `fullscreen-only` HTML attribute on `<chat-iva>`.
   */
  fullscreenOnly?: boolean;
  class?: string;
  style?: string;
  children?: Snippet;
  /** The underlying `<chat-iva>` element once it has mounted (`bind:element`). */
  element?: HTMLElement | null;
  /** A bot/connector message was delivered. */
  onmessage?: (message: IncomingMessage) => void;
  /** The user sent a message. */
  onmessagesent?: (message: OutgoingMessage) => void;
  /** The connector transitioned to `"connected"`. */
  onconnect?: () => void;
  /** The connector transitioned to `"disconnected"` or `"error"`. */
  ondisconnect?: (payload: { status: ConnectorStatus }) => void;
  /** The end-of-conversation survey was submitted. */
  onsurveysubmit?: (payload: SurveyPayload) => void;
  /** The chat panel opened. */
  onwidgetopen?: () => void;
  /** The chat panel closed. */
  onwidgetclose?: () => void;
}

export interface ChatBotButtonProps {
  class?: string;
  style?: string;
  /** Custom launcher content — rendered into the default slot. Omit for the built-in gradient circle + animated icons. */
  children?: Snippet;
  /** The underlying `<chat-bot-button>` element once it has mounted (`bind:element`). */
  element?: HTMLElement | null;
}

export interface GenUIMessageProps {
  /** The streaming GenUI message payload (`GenUIStreamState`), as delivered by `onGenUIChunk`/stored on the message. */
  messageData?: Record<string, unknown>;
  sender?: "user" | "bot";
  messageId?: string;
  timestamp?: number;
  hideAvatar?: boolean;
  status?: string;
  /** Show developer diagnostics (e.g. the unknown-component fallback). Off by default. */
  debug?: boolean;
  class?: string;
  style?: string;
  /** The underlying `<genui-message>` element once it has mounted (`bind:element`). */
  element?: HTMLElement | null;
}
