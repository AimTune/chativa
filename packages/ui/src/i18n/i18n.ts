import { i18next } from '@chativa/core';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import tr from './tr.json';

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
            fallbackLng: 'en',
            debug: false,
            showSupportNotice: false,
            resources: {
                en: { translation: en },
                tr: { translation: tr },
            },
            interpolation: {
                escapeValue: false, // Lit zaten güvenlidir
            },
        });
} else {
    // Another Chativa bundle already initialised it — contribute the resources
    // without resetting the language the host has settled on.
    i18next.addResourceBundle('en', 'translation', en, true, false);
    i18next.addResourceBundle('tr', 'translation', tr, true, false);
}

export default i18next;
