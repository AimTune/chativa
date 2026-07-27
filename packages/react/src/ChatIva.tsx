"use client";

import * as React from "react";
import { chatStore } from "@chativa/core";
import type {
  IConnector,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
  ConnectorStatus,
} from "@chativa/core";
import { loadChativaUi } from "./internal/loadChativaUi";
import { createLazyElementComponent } from "./internal/createLazyElementComponent";
import { resolveConnectorName } from "./internal/resolveConnector";
import { useChativaEvent } from "./hooks/useChativaEvent";

export interface ChatIvaProps {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and use. Defaults to whatever `<ChativaProvider>` (or `window.chativaSettings`) has activated. */
  connector?: string | IConnector;
  /**
   * Start in fullscreen and hide the fullscreen toggle. Equivalent to the
   * `fullscreen-only` HTML attribute on `<chat-iva>`.
   */
  fullscreenOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** A bot/connector message was delivered. */
  onMessage?: (message: IncomingMessage) => void;
  /** The user sent a message. */
  onMessageSent?: (message: OutgoingMessage) => void;
  /** The connector transitioned to `"connected"`. */
  onConnect?: () => void;
  /** The connector transitioned to `"disconnected"` or `"error"`. */
  onDisconnect?: (payload: { status: ConnectorStatus }) => void;
  /** The end-of-conversation survey was submitted. */
  onSurveySubmit?: (payload: SurveyPayload) => void;
  /** The chat panel opened. */
  onWidgetOpen?: () => void;
  /** The chat panel closed. */
  onWidgetClose?: () => void;
}

interface ChatIvaElementProps {
  connector?: string;
  fulllscreenOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

let cachedChatIva: React.ComponentType<
  ChatIvaElementProps & React.RefAttributes<HTMLElement>
> | null = null;

async function loadChatIvaElement() {
  if (cachedChatIva) return cachedChatIva;
  const [{ createComponent }, { ChatWidget }] = await Promise.all([
    import("@lit/react"),
    loadChativaUi(),
  ]);
  cachedChatIva = createComponent({
    react: React,
    tagName: "chat-iva",
    elementClass: ChatWidget,
  }) as unknown as React.ComponentType<ChatIvaElementProps & React.RefAttributes<HTMLElement>>;
  return cachedChatIva;
}

const LazyChatIva = createLazyElementComponent<ChatIvaElementProps, HTMLElement>(
  loadChatIvaElement,
  "LazyChatIva",
);

/**
 * React wrapper for `<chat-iva>` — the main Chativa chat widget (launcher +
 * panel). Renders nothing until the underlying `@chativa/ui` module has
 * loaded on the client, so it's safe to render from a Server Component tree.
 *
 * @example
 * ```tsx
 * import { ChatIva } from "@chativa/react";
 * import { DummyConnector } from "@chativa/connector-dummy";
 *
 * const dummy = new DummyConnector();
 *
 * <ChatIva connector={dummy} onMessage={(m) => console.log(m)} />
 * ```
 */
export const ChatIva = React.forwardRef<HTMLElement, ChatIvaProps>(function ChatIva(
  {
    connector,
    fullscreenOnly,
    onMessage,
    onMessageSent,
    onConnect,
    onDisconnect,
    onSurveySubmit,
    onWidgetOpen,
    onWidgetClose,
    ...rest
  },
  ref,
) {
  // Idempotent registry write — safe during render (mirrors how
  // ChatWidget.connectedCallback itself resolves the active connector), and
  // must complete before the underlying element connects.
  const connectorName = resolveConnectorName(connector);

  // `@lit/react` sets element properties via a ref, which React only runs
  // *after* the DOM node is inserted — but `ChatWidget.connectedCallback`
  // reads `this.connector` synchronously at connect time, before that ref
  // fires. Pushing the resolved name into the shared `chatStore` instead
  // works: `ChatWidget` prefers `themeState.activeConnector` over its own
  // `connector` property whenever the former isn't the default "dummy".
  if (connectorName !== undefined && chatStore.getState().activeConnector !== connectorName) {
    chatStore.getState().setConnector(connectorName);
  }

  useChativaEvent("message_received", onMessage);
  useChativaEvent("message_sent", onMessageSent);
  useChativaEvent("survey_submitted", onSurveySubmit);
  useChativaEvent("widget_opened", onWidgetOpen);
  useChativaEvent("widget_closed", onWidgetClose);
  useChativaEvent("connector_status_changed", (payload) => {
    if (payload.status === "connected") onConnect?.();
    else if (payload.status === "disconnected" || payload.status === "error") onDisconnect?.(payload);
  });

  const elementProps: ChatIvaElementProps = { ...rest };
  if (connectorName !== undefined) elementProps.connector = connectorName;
  if (fullscreenOnly !== undefined) elementProps.fulllscreenOnly = fullscreenOnly;

  return <LazyChatIva ref={ref} {...elementProps} />;
});
