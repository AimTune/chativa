/**
 * Global settings object read from `window.chativaSettings`.
 *
 * Consumers set this **before** the `<chat-iva>` element is connected:
 *
 * ```js
 * window.chativaSettings = {
 *   connector: myConnectorInstance,   // or just "directline"
 *   theme: { allowFullscreen: false, colors: { primary: "#1B1464" } },
 *   i18n: { header: { title: "Hey!" } },
 * };
 * ```
 */

import type { IConnector } from "../domain/ports/IConnector";
import type { DeepPartial, ThemeConfig } from "../domain/value-objects/Theme";
import { mergeTheme } from "../domain/value-objects/Theme";
import { ConnectorRegistry } from "./registries/ConnectorRegistry";
import chatStore from "./stores/ChatStore";
import { i18next } from "../ui/I18nMixin";

export interface ChativaSettings {
    /**
     * Connector — either a registered connector name (string)
     * or an `IConnector` instance that will be auto-registered.
     */
    connector?: string | IConnector;

    /** Theme overrides (deep-merged over the default theme). */
    theme?: DeepPartial<ThemeConfig>;

    /**
     * i18n translation overrides merged into the current language bundle.
     * Example: `{ header: { title: "My Bot" } }`
     */
    i18n?: Record<string, unknown>;
}

declare global {
    interface Window {
        chativaSettings?: ChativaSettings;
    }
}

let _applied = false;

/**
 * Read `window.chativaSettings` and apply it to the store / registries.
 * Safe to call multiple times — only the first call takes effect.
 */
export function applyGlobalSettings(): void {
    if (_applied) return;
    _applied = true;

    const settings = window.chativaSettings;
    if (!settings) return;

    // ── Connector ────────────────────────────────────────────────────
    if (settings.connector) {
        if (typeof settings.connector === "string") {
            chatStore.getState().setConnector(settings.connector);
        } else {
            // IConnector instance — register if not already registered
            const instance = settings.connector;
            if (!ConnectorRegistry.has(instance.name)) {
                ConnectorRegistry.register(instance);
            }
            chatStore.getState().setConnector(instance.name);
        }
    }

    // ── Theme ────────────────────────────────────────────────────────
    if (settings.theme) {
        const state = chatStore.getState();
        const merged = mergeTheme(state.theme, settings.theme);
        state.setTheme(merged);

        // Sync top-level store flags from theme
        if (settings.theme.allowFullscreen !== undefined) {
            state.setAllowFullscreen(settings.theme.allowFullscreen);
        }
    }

    // ── i18n ─────────────────────────────────────────────────────────
    if (settings.i18n) {
        const apply = () => {
            const lng = i18next.language ?? "en";
            i18next.addResourceBundle(lng, "translation", settings.i18n, true, true);
        };

        if (i18next.isInitialized) {
            apply();
        } else {
            i18next.on("initialized", apply);
        }
    }
}
