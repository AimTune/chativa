/**
 * Global settings object read from `window.chativaSettings`.
 *
 * Consumers set this **before** the `<chat-iva>` element is connected:
 *
 * ```js
 * window.chativaSettings = {
 *   connector: myConnectorInstance,   // or just "directline"
 *   theme: { allowFullscreen: false, colors: { primary: "#1B1464" } },
 *   locale: "tr",
 *   i18n: { all: { header: { title: "Hey!" } }, tr: { header: { title: "Selam!" } } },
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
     * Initial locale override. Skips browser detection and forces this language.
     * Example: `"tr"`, `"en"`
     */
    locale?: string;

    /**
     * i18n translation overrides.
     *
     * **Per-language format** — keys are locale codes, `all` applies to every language:
     * ```js
     * i18n: {
     *   all: { header: { title: "My Bot" } },          // applied to all languages
     *   tr:  { header: { title: "Botum" } },            // Turkish-specific override
     * }
     * ```
     *
     * **Flat format** (backward-compatible) — applied to all languages:
     * ```js
     * i18n: { header: { title: "My Bot" } }
     * ```
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

    // ── Locale ─────────────────────────────────────────────────────────
    // Must be applied before i18n overrides so the correct language is active.
    if (settings.locale) {
        const setLng = () => i18next.changeLanguage(settings.locale!);
        if (i18next.isInitialized) {
            setLng();
        } else {
            i18next.on("initialized", setLng);
        }
    }

    // ── i18n ─────────────────────────────────────────────────────────
    if (settings.i18n) {
        const isPerLanguage = _isPerLanguageFormat(settings.i18n);

        const i18nMap = settings.i18n as Record<string, Record<string, unknown>>;
        const allBundle = isPerLanguage ? i18nMap.all : undefined;

        /** Merge the "all" bundle + language-specific bundle into `lng`. */
        const applyToLng = (lng: string) => {
            if (allBundle) {
                i18next.addResourceBundle(lng, "translation", allBundle, true, true);
            }
            if (isPerLanguage && lng !== "all" && i18nMap[lng]) {
                i18next.addResourceBundle(lng, "translation", i18nMap[lng], true, true);
            }
        };

        const apply = () => {
            if (isPerLanguage) {
                // Apply "all" + per-language bundles to every registered language
                const langs = new Set([
                    ...Object.keys(i18next.store.data),
                    ...Object.keys(i18nMap).filter((k) => k !== "all"),
                ]);
                for (const lng of langs) {
                    applyToLng(lng);
                }
            } else {
                // Flat format: apply to ALL registered languages
                for (const lng of Object.keys(i18next.store.data)) {
                    i18next.addResourceBundle(lng, "translation", settings.i18n, true, true);
                }
            }
        };

        if (i18next.isInitialized) {
            apply();
        } else {
            i18next.on("initialized", apply);
        }

        // Re-apply overrides when the user switches language,
        // so custom translations are never lost.
        i18next.on("languageChanged", (lng: string) => {
            if (isPerLanguage) {
                applyToLng(lng);
            } else {
                i18next.addResourceBundle(lng, "translation", settings.i18n, true, true);
            }
        });
    }
}

/**
 * Detect whether the i18n object uses per-language format (keys are locale codes
 * or "all") or flat format (keys are translation namespaces like "header", "input").
 *
 * Heuristic: if every top-level key is a locale code (e.g. "en", "tr", "pt-BR")
 * or the special "all" keyword, and every value is a plain object, treat it as
 * per-language.
 */
function _isPerLanguageFormat(obj: Record<string, unknown>): boolean {
    const keys = Object.keys(obj);
    if (keys.length === 0) return false;
    const localePattern = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
    return keys.every(
        (k) =>
            (k === "all" || localePattern.test(k)) &&
            typeof obj[k] === "object" &&
            obj[k] !== null &&
            !Array.isArray(obj[k]),
    );
}
