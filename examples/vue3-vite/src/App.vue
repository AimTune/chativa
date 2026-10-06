<script setup lang="ts">
import { watch } from "vue";
import { useChat, useMessages, useGenUIStream, type IncomingMessage } from "@chativa/vue";
import { dummy } from "./connector";

const { isOpened, connectorStatus, isTyping, open } = useChat();
const { messages } = useMessages();
const { streams, isStreaming } = useGenUIStream();

/**
 * The chat engine only connects (and DummyConnector only registers its GenUI
 * handler) once the panel has been opened at least once — that's when
 * `<ChatIva>` lazily calls `connector.connect()`. Open the panel and wait for
 * a real "connected" status before running `fn`, instead of guessing at a delay.
 */
function runOnceConnected(fn: () => void): void {
  open();
  if (connectorStatus.value === "connected") {
    fn();
    return;
  }
  const stop = watch(connectorStatus, (status) => {
    if (status !== "connected") return;
    stop();
    fn();
  });
}

function triggerGenUI(command: "progress" | "text-stream"): void {
  runOnceConnected(() => dummy.triggerGenUI(command));
}

function onMessage(message: IncomingMessage): void {
  console.log("[chativa] message received:", message);
}
</script>

<template>
  <main class="page">
    <h1>@chativa/vue example</h1>
    <p>
      <code>app.use(ChativaPlugin, { connector, theme })</code> registers the
      connector + theme once and the components globally;
      <code>&lt;ChatBotButton&gt;</code> renders a custom launcher from its
      default slot; <code>&lt;ChatIva&gt;</code> is the panel it opens.
    </p>

    <p>
      Live state from the composables —
      <code>useChat()</code>: panel {{ isOpened ? "open" : "closed" }}, connector
      <strong>{{ connectorStatus }}</strong>{{ isTyping ? ", bot typing…" : "" }};
      <code>useMessages()</code>: {{ messages.length }} messages;
      <code>useGenUIStream()</code>: {{ streams.length }} GenUI streams{{ isStreaming ? " (streaming)" : "" }}.
    </p>

    <button class="trigger-genui" @click="triggerGenUI('progress')">
      Stream a GenUI progress widget
    </button>
    {{ " " }}
    <button class="trigger-genui" @click="triggerGenUI('text-stream')">
      Stream a token-by-token text reply
    </button>
  </main>

  <ChatBotButton>
    <button class="custom-launcher" aria-label="Open chat">
      <span class="custom-launcher-icon" aria-hidden="true">💬</span>
      Ask Iva
    </button>
  </ChatBotButton>

  <ChatIva
    @message="onMessage"
    @message-sent="(m) => console.log('[chativa] message sent:', m)"
    @widget-open="() => console.log('[chativa] widget opened')"
    @widget-close="() => console.log('[chativa] widget closed')"
  />
</template>
