"use client";

import * as React from "react";
import {
  ExtensionRegistry,
  chatStore,
  i18next,
  type IConnector,
  type IExtension,
  type DeepPartial,
  type ThemeConfig,
} from "@chativa/core";
import { resolveConnectorName } from "./internal/resolveConnector";

export interface ChativaProviderProps {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and activate as the default. */
  connector?: string | IConnector;
  /** Extensions to install once, before any child widget mounts. */
  extensions?: IExtension[];
  /** Theme overrides, deep-merged over the default theme. Reactive — updates re-apply. */
  theme?: DeepPartial<ThemeConfig>;
  /** Initial locale override (e.g. `"tr"`, `"en"`), skipping browser detection. */
  locale?: string;
  /** Flat i18n translation overrides, applied to every registered language — see `ChativaSettings.i18n` in `@chativa/core` for the full per-language format. */
  i18n?: Record<string, unknown>;
  children?: React.ReactNode;
}

/**
 * Registers a shared connector + extensions once, and applies theme/locale/
 * i18n overrides, for every Chativa widget rendered underneath it. This is
 * the React-idiomatic equivalent of setting `window.chativaSettings` before
 * `<chat-iva>` connects — no global object required.
 *
 * Connector/extension registration happens synchronously during the first
 * render (not inside a `useEffect`) so it's guaranteed to complete before
 * any nested `<ChatIva>` / `<ChatBotButton>` mounts its underlying custom
 * element and reads from `ConnectorRegistry` / `ExtensionRegistry`.
 */
export function ChativaProvider({
  connector,
  extensions,
  theme,
  locale,
  i18n,
  children,
}: ChativaProviderProps): React.ReactElement {
  React.useState(() => {
    const name = resolveConnectorName(connector);
    if (name) chatStore.getState().setConnector(name);

    extensions?.forEach((extension) => {
      if (!ExtensionRegistry.has(extension.name)) {
        ExtensionRegistry.install(extension);
      }
    });

    return null;
  });

  React.useEffect(() => {
    if (theme) chatStore.getState().setTheme(theme);
  }, [theme]);

  React.useEffect(() => {
    if (!locale) return;
    const apply = () => i18next.changeLanguage(locale);
    if (i18next.isInitialized) apply();
    else i18next.on("initialized", apply);
  }, [locale]);

  React.useEffect(() => {
    if (!i18n) return;
    for (const lng of Object.keys(i18next.store.data)) {
      i18next.addResourceBundle(lng, "translation", i18n, true, true);
    }
  }, [i18n]);

  return <>{children}</>;
}
