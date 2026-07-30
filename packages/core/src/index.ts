// @chativa/core — domain + application
export * from "./domain/index";
export * from "./application/index";

// ── UI base utilities ─────────────────────────────────────────────────────────
export { I18nMixin, i18next, t } from "./ui/I18nMixin";
export { ChativaElement } from "./ui/ChativaElement";
export { GenUIElement, GENUI_COMPONENT_EVENT } from "./ui/GenUIElement";
export type { GenUIComponentEventDetail } from "./ui/GenUIElement";
export { GenUIHtmlElement, sanitizeHtml } from "./ui/GenUIHtmlElement";
export { defineGenUIComponent, clearDefinedGenUIComponents } from "./ui/defineGenUIComponent";
export { renderTemplate, escapeHtml } from "./ui/template";
