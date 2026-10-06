<!--
  @component
  Svelte wrapper for `<chat-iva>` — the main Chativa chat panel. Renders
  nothing on the server and until `@chativa/ui` has loaded on the client, so
  it is safe to use in SvelteKit SSR/prerendered routes.

  ```svelte
  <ChatIva connector={dummy} onmessage={(m) => console.log(m)} />
  ```
-->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    chatStore,
    EventBus,
    type ConnectorStatus,
    type EventBusEventName,
    type EventBusPayloadMap,
    type IncomingMessage,
    type OutgoingMessage,
    type SurveyPayload,
  } from "@chativa/core";
  import { loadChativaUi } from "./internal/loadChativaUi.js";
  import { connectorNameOf, resolveConnectorName } from "./internal/resolveConnector.js";
  import type { ChatIvaProps } from "./types.js";

  type Props = ChatIvaProps;

  let {
    connector,
    fullscreenOnly = false,
    class: className,
    style,
    children,
    element = $bindable(null),
    onmessage,
    onmessagesent,
    onconnect,
    ondisconnect,
    onsurveysubmit,
    onwidgetopen,
    onwidgetclose,
  }: Props = $props();

  let loaded = $state(false);

  // Legacy `on:event` compatibility for Svelte 5 apps that still use the
  // Svelte 4 event syntax (`<ChatIva on:message={(e) => e.detail} />`).
  // Callback props are the primary API; this only reaches listeners that a
  // legacy-mode parent attached, and costs nothing otherwise.
  const dispatch = createEventDispatcher<{
    message: IncomingMessage;
    messagesent: OutgoingMessage;
    connect: undefined;
    disconnect: { status: ConnectorStatus };
    surveysubmit: SurveyPayload;
    widgetopen: undefined;
    widgetclose: undefined;
  }>();

  // `$effect.pre` runs on the client only, before the DOM is updated — so
  // this completes before `<chat-iva>` is created below. `ChatWidget`'s
  // connectedCallback prefers `chatStore.activeConnector` (whenever it isn't
  // the default "dummy") over its own `connector` property, and decides its
  // window mode while connecting, so the shared store is the one channel
  // that is guaranteed to be read in time. `fullscreenOnly={false}` is
  // deliberately not the inverse: it means "no opinion", so it never
  // re-enables a fullscreen toggle the theme turned off.
  $effect.pre(() => {
    const name = resolveConnectorName(connector);
    if (name !== undefined && chatStore.getState().activeConnector !== name) {
      chatStore.getState().setConnector(name);
    }
    if (fullscreenOnly) {
      const theme = chatStore.getState();
      if (!theme.isFullscreen) theme.setFullscreen(true);
      if (theme.allowFullscreen) theme.setAllowFullscreen(false);
    }
  });

  // Callback props are read when an event fires (not when subscribing), so
  // the latest handler is always the one invoked and swapping a handler
  // never re-subscribes.
  $effect(() => {
    const offs: Array<() => void> = [];
    const on = <K extends EventBusEventName>(
      event: K,
      handler: (payload: EventBusPayloadMap[K]) => void,
    ) => {
      EventBus.on(event, handler);
      offs.push(() => EventBus.off(event, handler));
    };
    on("message_received", (message) => {
      onmessage?.(message);
      dispatch("message", message);
    });
    on("message_sent", (message) => {
      onmessagesent?.(message);
      dispatch("messagesent", message);
    });
    on("survey_submitted", (payload) => {
      onsurveysubmit?.(payload);
      dispatch("surveysubmit", payload);
    });
    on("widget_opened", () => {
      onwidgetopen?.();
      dispatch("widgetopen");
    });
    on("widget_closed", () => {
      onwidgetclose?.();
      dispatch("widgetclose");
    });
    on("connector_status_changed", (payload) => {
      if (payload.status === "connected") {
        onconnect?.();
        dispatch("connect");
      } else if (payload.status === "disconnected" || payload.status === "error") {
        ondisconnect?.(payload);
        dispatch("disconnect", payload);
      }
    });
    return () => offs.forEach((off) => off());
  });

  onMount(() => {
    let cancelled = false;
    void loadChativaUi().then(() => {
      if (!cancelled) loaded = true;
    });
    return () => {
      cancelled = true;
    };
  });

  const elementProps = $derived.by(() => {
    const props: Record<string, string> = {};
    const name = connectorNameOf(connector);
    if (name !== undefined) props.connector = name;
    if (className !== undefined) props.class = className;
    if (style !== undefined) props.style = style;
    return props;
  });
</script>

{#if loaded}
  <chat-iva bind:this={element} {...elementProps}>
    {@render children?.()}
  </chat-iva>
{/if}
