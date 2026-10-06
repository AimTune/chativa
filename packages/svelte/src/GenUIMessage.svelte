<!--
  @component
  Svelte wrapper for `<genui-message>` — renders a streaming Generative UI
  message (text + registered GenUI components) outside of `<ChatIva>`'s own
  message list, e.g. to embed a single AI reply in a custom layout.

  Requires `@chativa/genui` to be installed — it is an optional peer
  dependency of `@chativa/svelte` (already pulled in transitively by
  `@chativa/ui` for `<ChatIva>`, but not otherwise).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { loadChativaGenUi } from "./internal/loadChativaUi.js";
  import type { GenUIMessageProps } from "./types.js";

  type Props = GenUIMessageProps;

  let {
    messageData,
    sender,
    messageId,
    timestamp,
    hideAvatar,
    status,
    debug,
    class: className,
    style,
    element = $bindable(null),
  }: Props = $props();

  let loaded = $state(false);
  // Local state (rather than reading the bindable `element` prop) so the
  // property effect below tracks the node even when the parent doesn't bind.
  let node = $state<HTMLElement | null>(null);

  $effect(() => {
    element = node;
  });

  onMount(() => {
    let cancelled = false;
    void loadChativaGenUi().then(() => {
      if (!cancelled) loaded = true;
    });
    return () => {
      cancelled = true;
    };
  });

  // Assigned as element *properties* (not attributes — `messageData` is an
  // object) once the element exists, and only the ones actually passed, so
  // the element keeps its own defaults (e.g. `sender = "bot"`) for the rest.
  // Lit batches property changes into one async render, so setting them
  // right after insertion still lands before the first paint.
  $effect(() => {
    const el = node as (HTMLElement & Record<string, unknown>) | null;
    if (!el) return;
    if (messageData !== undefined) el.messageData = messageData;
    if (sender !== undefined) el.sender = sender;
    if (messageId !== undefined) el.messageId = messageId;
    if (timestamp !== undefined) el.timestamp = timestamp;
    if (hideAvatar !== undefined) el.hideAvatar = hideAvatar;
    if (status !== undefined) el.status = status;
    if (debug !== undefined) el.debug = debug;
  });
</script>

{#if loaded}
  <genui-message bind:this={node} class={className} {style}></genui-message>
{/if}
