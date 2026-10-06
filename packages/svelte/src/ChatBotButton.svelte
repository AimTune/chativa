<!--
  @component
  Svelte wrapper for `<chat-bot-button>` — the floating launcher button.
  `<ChatIva>` is only the chat panel; it has no launcher of its own, so a
  normal popup setup renders `<ChatBotButton>` alongside it to toggle the
  shared `chatStore`'s open state. Pass children to replace the default
  gradient-circle icon with a fully custom launcher element.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { loadChativaUi } from "./internal/loadChativaUi.js";
  import type { ChatBotButtonProps } from "./types.js";

  type Props = ChatBotButtonProps;

  let { class: className, style, children, element = $bindable(null) }: Props = $props();

  let loaded = $state(false);

  onMount(() => {
    let cancelled = false;
    void loadChativaUi().then(() => {
      if (!cancelled) loaded = true;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if loaded}
  <chat-bot-button bind:this={element} class={className} {style}>
    {@render children?.()}
  </chat-bot-button>
{/if}
