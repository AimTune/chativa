<script lang="ts">
  import {
    ChativaProvider,
    ChatIva,
    ChatBotButton,
    chatState,
    messages,
    onChativaEvent,
    type IncomingMessage,
  } from "@chativa/svelte";
  import { chatStore } from "@chativa/core";
  import { DummyConnector } from "@chativa/connector-dummy";
  import "../app.css";

  // One instance for the page's lifetime — re-creating the connector would
  // register a new one each time and throw ("already registered").
  // connectDelay: 0 skips DummyConnector's default 2s fake-handshake delay,
  // since the trigger button below waits for a real "connected" status.
  const dummy = new DummyConnector({ replyDelay: 500, connectDelay: 0 });

  let lastBotMessage = $state<string | null>(null);

  function onmessage(message: IncomingMessage) {
    const text = message.data?.text;
    lastBotMessage = typeof text === "string" ? text : `[${message.type}]`;
  }

  // The chat engine only connects once the panel has been opened at least
  // once. Open it and wait for `connector_status_changed: "connected"`
  // before running `fn`, instead of guessing at a delay.
  function runOnceConnected(fn: () => void) {
    if (chatStore.getState().connectorStatus === "connected") {
      fn();
      chatStore.getState().open();
      return;
    }
    const off = onChativaEvent("connector_status_changed", ({ status }) => {
      if (status !== "connected") return;
      off();
      fn();
    });
    chatStore.getState().open();
  }

  // Log every outgoing message for the lifetime of this page — the returned
  // unsubscribe is the effect's cleanup.
  $effect(() => onChativaEvent("message_sent", (m) => console.log("[chativa] message sent:", m)));
</script>

<ChativaProvider
  connector={dummy}
  theme={{
    colors: { primary: "#ff3e00", secondary: "#4f46e5" },
    // Hide the (custom) launcher while the panel is open.
    hideButtonOnOpen: true,
  }}
>
  <main class="page">
    <h1>@chativa/svelte example</h1>
    <p>
      This page is <strong>prerendered</strong> by SvelteKit — the wrappers render nothing on
      the server and load <code>@chativa/ui</code> on the client only.
    </p>

    <dl class="state">
      <dt><code>$chatState.connectorStatus</code></dt>
      <dd data-testid="status">{$chatState.connectorStatus}</dd>
      <dt><code>$chatState.isOpened</code></dt>
      <dd>{$chatState.isOpened}</dd>
      <dt><code>$messages.length</code></dt>
      <dd>{$messages.length}</dd>
      <dt>Last bot message (<code>onmessage</code>)</dt>
      <dd>{lastBotMessage ?? "—"}</dd>
    </dl>

    <button class="trigger-genui" onclick={() => runOnceConnected(() => dummy.triggerGenUI("list"))}>
      Trigger GenUI (list)
    </button>
  </main>

  <ChatBotButton>
    <button class="custom-launcher" aria-label="Open chat">
      <span aria-hidden="true">💬</span> Ask Iva
    </button>
  </ChatBotButton>

  <ChatIva
    {onmessage}
    onwidgetopen={() => console.log("[chativa] widget opened")}
    onwidgetclose={() => console.log("[chativa] widget closed")}
  />
</ChativaProvider>
