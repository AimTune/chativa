import type { PluginObject, VueConstructor } from "vue";
import { applySettings, type ChativaSettingsInput } from "./internal/applySettings";
import { ChatIva } from "./ChatIva";
import { ChatBotButton } from "./ChatBotButton";
import { GenUIMessage } from "./GenUIMessage";

export interface ChativaPluginOptions extends ChativaSettingsInput {
  /**
   * Register `ChatIva`, `ChatBotButton` and `GenUIMessage` as global
   * components. Defaults to `true`; pass `false` to import them locally
   * instead.
   */
  components?: boolean;
}

/** Custom element tags Vue 2 must not treat as unknown components. */
const CHATIVA_TAGS = ["chat-iva", "chat-bot-button", "genui-message"];

/**
 * Vue 2 plugin — `Vue.use(Chativa, { connector, extensions })`.
 *
 * Applies the app-wide settings once (registers + activates the connector,
 * installs extensions, applies theme / locale / i18n overrides), adds the
 * Chativa tags to `Vue.config.ignoredElements`, and registers the wrapper
 * components globally.
 *
 * Note: with the components registered globally, Vue resolves a kebab-case
 * `<chat-iva>` in templates to the `ChatIva` wrapper too — which accepts
 * the same `connector` / `fullscreen-only` inputs as the raw element.
 */
export const Chativa: PluginObject<ChativaPluginOptions> = {
  install(Vue: VueConstructor, options: ChativaPluginOptions = {}) {
    const { components = true, ...settings } = options;

    applySettings(settings);

    const ignored = Vue.config.ignoredElements;
    for (const tag of CHATIVA_TAGS) {
      if (!ignored.includes(tag)) ignored.push(tag);
    }

    if (components) {
      Vue.component("ChatIva", ChatIva);
      Vue.component("ChatBotButton", ChatBotButton);
      Vue.component("GenUIMessage", GenUIMessage);
    }
  },
};
