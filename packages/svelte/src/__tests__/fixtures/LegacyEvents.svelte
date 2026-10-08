<svelte:options runes={false} />

<!-- A Svelte 4-syntax (legacy mode) parent using `on:` directives. -->
<script lang="ts">
  import ChatIva from "../../ChatIva.svelte";
  import type { IConnector } from "@chativa/core";

  export let connector: IConnector;
  export let log: (event: CustomEvent) => void;
</script>

<ChatIva
  {connector}
  on:message={log}
  on:messagesent={log}
  on:connect={log}
  on:disconnect={log}
  on:surveysubmit={log}
  on:widgetopen={log}
  on:widgetclose={log}
/>
