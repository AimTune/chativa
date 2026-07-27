"use client";

import * as React from "react";
import { loadChativaUi } from "./internal/loadChativaUi";
import { createLazyElementComponent } from "./internal/createLazyElementComponent";

export interface ChatBotButtonProps {
  className?: string;
  style?: React.CSSProperties;
  /** Custom launcher content — rendered into the default slot. Omit for the built-in gradient circle + animated icons. */
  children?: React.ReactNode;
}

let cachedChatBotButton: React.ComponentType<
  ChatBotButtonProps & React.RefAttributes<HTMLElement>
> | null = null;

async function loadChatBotButtonElement() {
  if (cachedChatBotButton) return cachedChatBotButton;
  const [{ createComponent }, { ChatBotButton: ChatBotButtonElement }] = await Promise.all([
    import("@lit/react"),
    loadChativaUi(),
  ]);
  cachedChatBotButton = createComponent({
    react: React,
    tagName: "chat-bot-button",
    elementClass: ChatBotButtonElement,
  }) as unknown as React.ComponentType<ChatBotButtonProps & React.RefAttributes<HTMLElement>>;
  return cachedChatBotButton;
}

const LazyChatBotButton = createLazyElementComponent<ChatBotButtonProps, HTMLElement>(
  loadChatBotButtonElement,
  "LazyChatBotButton",
);

/**
 * React wrapper for `<chat-bot-button>` — the floating launcher button.
 * `<ChatIva>` is only the chat panel; it has no launcher of its own, so a
 * normal popup setup renders `<ChatBotButton>` alongside it to toggle the
 * shared `chatStore`'s open state. Pass children to replace the default
 * gradient-circle icon with a fully custom launcher element.
 */
export const ChatBotButton = React.forwardRef<HTMLElement, ChatBotButtonProps>(
  function ChatBotButton(props, ref) {
    return <LazyChatBotButton ref={ref} {...props} />;
  },
);
