<!-- <ChativaProvider> wrapping a connector-less <ChatIva> + <ChatBotButton>. -->
<script lang="ts">
  import ChativaProvider from "../../ChativaProvider.svelte";
  import ChatIva from "../../ChatIva.svelte";
  import ChatBotButton from "../../ChatBotButton.svelte";
  import type { IConnector } from "@chativa/core";

  let { connector }: { connector: IConnector } = $props();
</script>

<ChativaProvider {connector}>
  <ChatBotButton>
    <button class="custom-launcher">Ask</button>
  </ChatBotButton>
  <ChatIva />
</ChativaProvider>
