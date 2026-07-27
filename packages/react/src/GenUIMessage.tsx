"use client";

import * as React from "react";
import { loadChativaGenUi } from "./internal/loadChativaUi";
import { createLazyElementComponent } from "./internal/createLazyElementComponent";

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
  className?: string;
  style?: React.CSSProperties;
}

let cachedGenUIMessage: React.ComponentType<
  GenUIMessageProps & React.RefAttributes<HTMLElement>
> | null = null;

async function loadGenUIMessageElement() {
  if (cachedGenUIMessage) return cachedGenUIMessage;
  const [{ createComponent }, { GenUIMessage: GenUIMessageElement }] = await Promise.all([
    import("@lit/react"),
    loadChativaGenUi(),
  ]);
  cachedGenUIMessage = createComponent({
    react: React,
    tagName: "genui-message",
    elementClass: GenUIMessageElement,
  }) as unknown as React.ComponentType<GenUIMessageProps & React.RefAttributes<HTMLElement>>;
  return cachedGenUIMessage;
}

const LazyGenUIMessage = createLazyElementComponent<GenUIMessageProps, HTMLElement>(
  loadGenUIMessageElement,
  "LazyGenUIMessage",
);

/**
 * React wrapper for `<genui-message>` — renders a streaming Generative UI
 * message (text + registered GenUI components) outside of `<ChatIva>`'s own
 * message list, e.g. to embed a single AI reply in a custom layout.
 *
 * Requires `@chativa/genui` to be installed — it is an optional peer
 * dependency of `@chativa/react` (already pulled in transitively by
 * `@chativa/ui` for `<ChatIva>`, but not otherwise).
 */
export const GenUIMessage = React.forwardRef<HTMLElement, GenUIMessageProps>(
  function GenUIMessage(props, ref) {
    return <LazyGenUIMessage ref={ref} {...props} />;
  },
);
