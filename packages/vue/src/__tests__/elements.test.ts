import { describe, it, expect, afterEach } from "vitest";
import { mount, enableAutoUnmount } from "@vue/test-utils";
import { h } from "vue";
import { ChatBotButton } from "../ChatBotButton";
import { GenUIMessage } from "../GenUIMessage";
import { waitForElement } from "./helpers";

enableAutoUnmount(afterEach);

describe("ChatBotButton", () => {
  it("renders nothing synchronously, then mounts <chat-bot-button>", async () => {
    const wrapper = mount(ChatBotButton, { attachTo: document.body });
    expect(wrapper.find("chat-bot-button").exists()).toBe(false);

    await waitForElement(wrapper, "chat-bot-button");
    const el = wrapper.find("chat-bot-button").element;
    expect(el).toBeInstanceOf(customElements.get("chat-bot-button")!);
    expect((wrapper.vm as unknown as { element: HTMLElement | null }).element).toBe(el);
  });

  it("forwards default-slot content as a custom launcher and falls through class", async () => {
    const wrapper = mount(ChatBotButton, {
      attachTo: document.body,
      attrs: { class: "my-launcher" },
      slots: { default: () => h("span", { class: "custom-icon" }, "Chat") },
    });
    await waitForElement(wrapper, "chat-bot-button");

    expect(wrapper.find("chat-bot-button .custom-icon").exists()).toBe(true);
    expect(wrapper.find("chat-bot-button").classes()).toContain("my-launcher");
  });

  it("does not render the element if unmounted before the module resolved", async () => {
    const wrapper = mount(ChatBotButton, { attachTo: document.body });
    wrapper.unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("chat-bot-button")).toBeNull();
  });
});

describe("GenUIMessage", () => {
  it("sets every prop as a DOM property (objects keep their identity)", async () => {
    const messageData = {
      chunks: [{ type: "text", content: "Hello", id: 1 }],
      streamingComplete: true,
    };
    const wrapper = mount(GenUIMessage, {
      attachTo: document.body,
      props: {
        messageData,
        sender: "bot",
        messageId: "vue-genui-1",
        timestamp: 123,
        hideAvatar: true,
        status: "read",
        debug: true,
      },
    });
    await waitForElement(wrapper, "genui-message");

    const el = wrapper.find("genui-message").element as HTMLElement & Record<string, unknown>;
    expect(el.messageData).toBe(messageData);
    expect(el.sender).toBe("bot");
    expect(el.messageId).toBe("vue-genui-1");
    expect(el.timestamp).toBe(123);
    expect(el.hideAvatar).toBe(true);
    expect(el.status).toBe("read");
    expect(el.debug).toBe(true);
  });

  it("keeps the element's own defaults for props that are not passed", async () => {
    const wrapper = mount(GenUIMessage, { attachTo: document.body });
    await waitForElement(wrapper, "genui-message");
    const el = wrapper.find("genui-message").element as HTMLElement & Record<string, unknown>;
    expect(el.sender).toBe("bot");
    expect(el.hideAvatar).toBe(false);
  });

  it("re-emits the kebab-case genui-send-event DOM event as camelCase genuiSendEvent", async () => {
    const wrapper = mount(GenUIMessage, {
      attachTo: document.body,
      props: { messageId: "vue-genui-2" },
    });
    await waitForElement(wrapper, "genui-message");

    const detail = { msgId: "vue-genui-2", eventType: "form_submit", payload: { a: 1 }, sourceId: 3 };
    wrapper
      .find("genui-message")
      .element.dispatchEvent(new CustomEvent("genui-send-event", { detail, bubbles: true }));

    expect(wrapper.emitted("genuiSendEvent")).toEqual([[detail]]);
  });
});
