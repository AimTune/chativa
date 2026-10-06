import { i18next } from '@chativa/core';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import tr from './tr.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import it from './it.json';
import ptBR from './pt-BR.json';
import pl from './pl.json';
import nl from './nl.json';
import id from './id.json';
import vi from './vi.json';
import ru from './ru.json';
import uk from './uk.json';
import ja from './ja.json';
import ko from './ko.json';
import zhCN from './zh-CN.json';
import zhTW from './zh-TW.json';
import hi from './hi.json';
import ar from './ar.json';
import he from './he.json';

/**
 * Every language bundled with the widget, keyed by the code it is registered
 * under. Codes follow BCP 47 with the region where the variant matters
 * (`pt-BR`, `zh-CN`, `zh-TW`) — see `FALLBACK_LNG` for how other spellings of
 * those languages resolve.
 */
export const BUNDLED_LOCALES = {
    en,
    tr,
    es,
    fr,
    de,
    it,
    'pt-BR': ptBR,
    pl,
    nl,
    id,
    vi,
    ru,
    uk,
    ja,
    ko,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    hi,
    ar,
    he,
} as const;

export type BundledLocale = keyof typeof BUNDLED_LOCALES;

/** Codes of every bundled language, e.g. for building a language picker. */
export const SUPPORTED_LOCALES = Object.keys(BUNDLED_LOCALES) as BundledLocale[];

/**
 * Fallback chains for language codes the detector can report but no bundle is
 * registered under. i18next first tries the exact code, then its script
 * (`zh-Hant`) and bare language (`zh`) parts, and only then this table — looked
 * up by exact code, script part, then language part, then `default`.
 *
 * - Portuguese of any region (`pt`, `pt-PT`, `pt-AO`…) → Brazilian Portuguese.
 * - Traditional Chinese (`zh-Hant`, `zh-Hant-*`, `zh-HK`, `zh-MO`) → `zh-TW`.
 * - Any other Chinese (`zh`, `zh-Hans`, `zh-SG`…) → `zh-CN`.
 * - Hebrew's legacy ISO 639 code `iw` (still sent by some Android WebViews) → `he`.
 * - Everything else → English.
 */
export const FALLBACK_LNG = {
    pt: ['pt-BR', 'en'],
    'zh-Hant': ['zh-TW', 'en'],
    'zh-HK': ['zh-TW', 'en'],
    'zh-MO': ['zh-TW', 'en'],
    'zh-Hans': ['zh-CN', 'en'],
    zh: ['zh-CN', 'en'],
    iw: ['he', 'en'],
    default: ['en'],
};

// Configure the instance `@chativa/core` exports — NOT a fresh `import i18next
// from "i18next"`. Those are the same object only when the bundler happens to
// dedupe the two packages' copies of i18next; when it doesn't, `ChativaSettings`
// (and `<ChativaProvider>`) write `locale`/`i18n` overrides into an instance no
// component ever reads from, so the bot name and language props silently do
// nothing. Going through core makes one instance the definition, not a
// coincidence of resolution.
if (!i18next.isInitialized) {
    i18next
        .use(LanguageDetector)
        .init({
            fallbackLng: FALLBACK_LNG,
            debug: false,
            showSupportNotice: false,
            resources: Object.fromEntries(
                Object.entries(BUNDLED_LOCALES).map(([lng, translation]) => [lng, { translation }]),
            ),
            interpolation: {
                escapeValue: false, // Lit is already safe
            },
        });
} else {
    // Another Chativa bundle already initialised it — contribute the resources
    // without resetting the language the host has settled on.
    for (const [lng, translation] of Object.entries(BUNDLED_LOCALES)) {
        i18next.addResourceBundle(lng, 'translation', translation, true, false);
    }
}

export default i18next;
