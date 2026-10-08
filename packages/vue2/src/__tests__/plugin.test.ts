import { describe, it, expect, afterEach } from "vitest";
import { createLocalVue, mount, type Wrapper } from "@vue/test-utils";
import Vue, { type CreateElement } from "vue";
import {
  ConnectorRegistry,
  ExtensionRegistry,
  chatStore,
  i18next,
  type IExtension,
} from "@chativa/core";
import ChativaDefault, { Chativa, ChatIva, ChatBotButton, GenUIMessage } from "../index";
import { loadChativaUi } from "../internal/loadChativaUi";
import { attachPoint, makeFakeConnector, waitFor } from "./helpers";

let wrapper: Wrapper<Vue> | null = null;

afterEach(() => {
  wrapper?.destroy();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("Chativa plugin", () => {
  it("is the package's default export", () => {
    expect(ChativaDefault).toBe(Chativa);
  });

  it("registers + activates the connector, installs extensions and applies the theme", () => {
    let installs = 0;
    const extension: IExtension = {
      name: "vue2-plugin-extension",
      version: "1.0.0",
      install() {
        installs++;
      },
    };

    const localVue = createLocalVue();
    localVue.use(Chativa, {
      connector: makeFakeConnector("vue2-plugin-connector"),
      extensions: [extension],
      theme: { colors: { primary: "#123456" } },
    });

    expect(ConnectorRegistry.has("vue2-plugin-connector")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("vue2-plugin-connector");
    expect(ExtensionRegistry.has("vue2-plugin-extension")).toBe(true);
    expect(chatStore.getState().theme.colors.primary).toBe("#123456");

    // A second app installing the same extension does not re-install it.
    createLocalVue().use(Chativa, { extensions: [extension] });
    expect(installs).toBe(1);

    ExtensionRegistry.uninstall("vue2-plugin-extension");
    ConnectorRegistry.unregister("vue2-plugin-connector");
  });

  it("registers the components globally and marks the Chativa tags as ignored elements", () => {
    const localVue = createLocalVue();
    localVue.use(Chativa);

    // `Vue.component()` stores the `Vue.extend()`ed constructor of each definition.
    const components = (localVue as unknown as { options: { components: unknown } }).options.components as Record<string, { options: { name: string } }>;
    expect(components.ChatIva.options.name).toBe(ChatIva.name);
    expect(components.ChatBotButton.options.name).toBe(ChatBotButton.name);
    expect(components.GenUIMessage.options.name).toBe(GenUIMessage.name);
    expect(localVue.config.ignoredElements).toEqual(
      expect.arrayContaining(["chat-iva", "chat-bot-button", "genui-message"]),
    );
  });

  it("skips global registration with components: false", () => {
    const localVue = createLocalVue();
    localVue.use(Chativa, { components: false });
    expect(((localVue as unknown as { options: { components: unknown } }).options.components as Record<string, unknown>).ChatIva).toBeUndefined();
  });

  it("renders the globally registered wrappers by PascalCase and kebab-case tag without recursing", async () => {
    const localVue = createLocalVue();
    localVue.use(Chativa, { connector: makeFakeConnector("vue2-plugin-render") });

    const App = Vue.extend({
      render(h: CreateElement) {
        // `chat-iva` resolves to the ChatIva wrapper once it is registered
        // globally — the wrapper must still render the real element inside.
        return h("div", [h("ChatIva"), h("chat-bot-button")]);
      },
    });
    wrapper = mount(App, { localVue, attachTo: attachPoint() });

    await waitFor(() => {
      expect(document.querySelectorAll("chat-iva")).toHaveLength(1);
      expect(document.querySelectorAll("chat-bot-button")).toHaveLength(1);
    });
    expect(wrapper.findComponent(ChatIva).exists()).toBe(true);
    expect(wrapper.findComponent(ChatBotButton).exists()).toBe(true);
  });

  it("applies locale and flat i18n overrides once i18next is initialised", async () => {
    await loadChativaUi(); // initialises i18next
    expect(i18next.isInitialized).toBe(true);

    createLocalVue().use(Chativa, {
      locale: "tr",
      i18n: { "vue2.test.key": "Merhaba Vue 2" },
    });

    await waitFor(() => expect(i18next.language).toBe("tr"));
    expect(i18next.t("vue2.test.key")).toBe("Merhaba Vue 2");

    await i18next.changeLanguage("en");
    expect(i18next.t("vue2.test.key")).toBe("Merhaba Vue 2");
  });
});
