import type { App } from "vue";
import {
  ExtensionRegistry,
  chatStore,
  i18next,
  type IConnector,
  type IExtension,
  type DeepPartial,
  type ThemeConfig,
} from "@chativa/core";
import { ChatIva } from "./ChatIva";
import { ChatBotButton } from "./ChatBotButton";
import { GenUIMessage } from "./GenUIMessage";
import { resolveConnectorName } from "./internal/resolveConnector";
import { canUseDOM } from "./internal/env";

/** Options accepted by `app.use(ChativaPlugin, options)`. */
export interface ChativaPluginOptions {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and activate as the default. */
  connector?: string | IConnector;
  /** Extensions to install once, before any widget mounts. */
  extensions?: IExtension[];
  /** Theme overrides, deep-merged over the default theme. */
  theme?: DeepPartial<ThemeConfig>;
  /** Initial locale override (e.g. `"tr"`, `"en"`), skipping browser detection. */
  locale?: string;
  /** Flat i18n translation overrides, applied to every registered language — see `ChativaSettings.i18n` in `@chativa/core` for the full per-language format. */
  i18n?: Record<string, unknown>;
  /**
   * Register `<ChatIva>`, `<ChatBotButton>` and `<GenUIMessage>` as global
   * components. Defaults to `true`; pass `false` to import them per-component
   * (better tree-shaking) while still using the plugin for configuration.
   */
  registerComponents?: boolean;
}

/**
 * Applies connector / extensions / theme / locale / i18n once for every
 * Chativa widget in the app — the Vue equivalent of `@chativa/react`'s
 * `<ChativaProvider>` (and of setting `window.chativaSettings` before
 * `<chat-iva>` connects). Runs before any component mounts, so the
 * registries are populated by the time `<ChatIva>` connects.
 *
 * All configuration is skipped during server rendering: the stores and
 * registries are process-wide singletons there, shared by every request, and
 * no widget connects on the server anyway. Components are still registered,
 * so templates resolve `<ChatIva />` on both sides.
 */
export function applyChativaOptions(options: ChativaPluginOptions): void {
  if (!canUseDOM()) return;
  const { connector, extensions, theme, locale, i18n } = options;

  const name = resolveConnectorName(connector);
  if (name) chatStore.getState().setConnector(name);

  extensions?.forEach((extension) => {
    if (!ExtensionRegistry.has(extension.name)) {
      ExtensionRegistry.install(extension);
    }
  });

  if (theme) chatStore.getState().setTheme(theme);

  // `i18next` is initialised by `@chativa/ui`, which the components load
  // lazily — so at install time there is usually nothing to write into yet.
  if (locale) {
    const applyLocale = () => {
      void i18next.changeLanguage(locale);
    };
    if (i18next.isInitialized) applyLocale();
    else i18next.on("initialized", applyLocale);
  }

  if (i18n) {
    const applyToLng = (lng: string) => {
      i18next.addResourceBundle(lng, "translation", i18n, true, true);
    };
    const applyToAll = () => Object.keys(i18next.store.data).forEach(applyToLng);
    if (i18next.isInitialized) applyToAll();
    else i18next.on("initialized", applyToAll);
    // Overrides sit on top of a language's own bundle, so switching language
    // would otherwise fall back to the shipped strings.
    i18next.on("languageChanged", applyToLng);
  }
}

/**
 * Vue plugin for Chativa.
 *
 * @example
 * ```ts
 * import { createApp } from "vue";
 * import { ChativaPlugin } from "@chativa/vue";
 * import { DummyConnector } from "@chativa/connector-dummy";
 *
 * createApp(App)
 *   .use(ChativaPlugin, { connector: new DummyConnector(), theme: { colors: { primary: "#42b883" } } })
 *   .mount("#app");
 * ```
 */
export const ChativaPlugin = {
  install(app: App, options: ChativaPluginOptions = {}): void {
    if (options.registerComponents !== false) {
      app.component("ChatIva", ChatIva);
      app.component("ChatBotButton", ChatBotButton);
      app.component("GenUIMessage", GenUIMessage);
    }
    applyChativaOptions(options);
  },
};
