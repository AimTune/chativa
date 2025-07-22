import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import tr from './tr.json';

i18next
    .use(LanguageDetector)
    .init({
        fallbackLng: 'en',
        debug: false,
        resources: {
            en: { translation: en },
            tr: { translation: tr },
        },
        interpolation: {
            escapeValue: false, // Lit zaten güvenlidir
        },
    });

export default i18next;
