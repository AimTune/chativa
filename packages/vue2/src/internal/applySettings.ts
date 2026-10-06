import {
  ExtensionRegistry,
  chatStore,
  i18next,
  type IConnector,
  type IExtension,
  type DeepPartial,
  type ThemeConfig,
} from "@chativa/core";
import { resolveConnectorName } from "./resolveConnector";

export interface ChativaSettingsInput {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and activate as the default. */
  connector?: string | IConnector;
  /** Extensions to install once, before any widget mounts. Already-installed names are skipped. */
  extensions?: IExtension[];
  /** Theme overrides, deep-merged over the default theme. */
  theme?: DeepPartial<ThemeConfig>;
  /** Initial locale override (e.g. `"tr"`, `"en"`), skipping browser detection. */
  locale?: string;
  /** Flat i18n translation overrides, applied to every registered language. */
  i18n?: Record<string, unknown>;
}

/**
 * Applies app-wide Chativa settings to the shared `@chativa/core` singletons
 * (`ConnectorRegistry`, `ExtensionRegistry`, `chatStore`, `i18next`). This is
 * the Vue 2 equivalent of setting `window.chativaSettings` before
 * `<chat-iva>` connects, and of `@chativa/react`'s `<ChativaProvider>`.
 *
 * Settings live for the lifetime of the page, so the i18next listeners are
 * intentionally never removed.
 */
export function applySettings({ connector, extensions, theme, locale, i18n }: ChativaSettingsInput): void {
  const name = resolveConnectorName(connector);
  if (name) chatStore.getState().setConnector(name);

  extensions?.forEach((extension) => {
    if (!ExtensionRegistry.has(extension.name)) {
      ExtensionRegistry.install(extension);
    }
  });

  if (theme) chatStore.getState().setTheme(theme);

  if (locale) {
    const apply = () => {
      void i18next.changeLanguage(locale);
    };
    if (i18next.isInitialized) apply();
    else i18next.on("initialized", apply);
  }

  if (i18n) {
    // `i18next.store` only exists once the instance is initialised, which
    // `@chativa/ui` does when it is (lazily) loaded — so the overrides may
    // have to wait for that.
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
