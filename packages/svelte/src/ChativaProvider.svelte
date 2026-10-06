<!--
  @component
  Registers a shared connector + extensions once, and applies theme/locale/
  i18n overrides, for every Chativa widget rendered inside it. The
  Svelte-idiomatic equivalent of setting `window.chativaSettings` before
  `<chat-iva>` connects — no global object required.

  Connector/extension registration runs synchronously while this component
  initialises (client only), i.e. before any nested `<ChatIva>` /
  `<ChatBotButton>` initialises, so their elements always find the
  connector already in `ConnectorRegistry` / `chatStore`.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { ExtensionRegistry, chatStore, i18next } from "@chativa/core";
  import { isBrowser } from "./internal/env.js";
  import { resolveConnectorName } from "./internal/resolveConnector.js";
  import type { ChativaProviderProps } from "./types.js";

  type Props = ChativaProviderProps;

  let { connector, extensions, theme, locale, i18n, children }: Props = $props();

  if (isBrowser()) {
    untrack(() => {
      const name = resolveConnectorName(connector);
      if (name) chatStore.getState().setConnector(name);

      extensions?.forEach((extension) => {
        if (!ExtensionRegistry.has(extension.name)) {
          ExtensionRegistry.install(extension);
        }
      });
    });
  }

  $effect(() => {
    // `$state.snapshot` reads every nested field, so a deep mutation of a
    // `$state` theme object re-applies it too — and hands zustand a plain
    // object rather than a Svelte proxy.
    const overrides = $state.snapshot(theme);
    if (overrides) chatStore.getState().setTheme(overrides);
  });

  $effect(() => {
    if (!locale) return;
    const lng = locale;
    const apply = () => {
      void i18next.changeLanguage(lng);
    };
    if (i18next.isInitialized) {
      apply();
      return;
    }
    i18next.on("initialized", apply);
    return () => i18next.off("initialized", apply);
  });

  $effect(() => {
    const overrides = $state.snapshot(i18n);
    if (!overrides) return;
    // `i18next.store` only exists once the instance is initialised, and the
    // instance is initialised by `@chativa/ui`, which the widgets load
    // lazily — so on the first run there may be nothing to write into yet.
    const applyToLng = (lng: string) => {
      i18next.addResourceBundle(lng, "translation", overrides, true, true);
    };
    const applyToAll = () => Object.keys(i18next.store.data).forEach(applyToLng);
    if (i18next.isInitialized) applyToAll();
    else i18next.on("initialized", applyToAll);
    // Overrides sit on top of a language's own bundle, so switching language
    // would otherwise fall back to the shipped strings.
    i18next.on("languageChanged", applyToLng);
    return () => {
      i18next.off("initialized", applyToAll);
      i18next.off("languageChanged", applyToLng);
    };
  });
</script>

{@render children?.()}
