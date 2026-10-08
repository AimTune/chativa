import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, type Wrapper } from "@vue/test-utils";
import type Vue from "vue";
import { ChatBotButton } from "../ChatBotButton";
import { attachPoint, mountable, waitFor } from "./helpers";

let wrapper: Wrapper<Vue> | null = null;

afterEach(() => {
  wrapper?.destroy();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("ChatBotButton", () => {
  it("lazily renders <chat-bot-button> with slotted launcher content", async () => {
    wrapper = mount(mountable(ChatBotButton), {
      attachTo: attachPoint(),
      slots: { default: '<button class="custom-launcher">Ask</button>' },
    });
    expect(document.querySelector("chat-bot-button")).toBeNull();

    await waitFor(() => expect(document.querySelector("chat-bot-button")).not.toBeNull());
    expect(wrapper.element.tagName.toLowerCase()).toBe("chat-bot-button");
    expect(wrapper.element.querySelector(".custom-launcher")?.textContent).toBe("Ask");
  });

  it("forwards listeners to the element", async () => {
    const onClick = vi.fn();
    wrapper = mount(mountable(ChatBotButton), { attachTo: attachPoint(), listeners: { click: onClick } });
    await waitFor(() => expect(document.querySelector("chat-bot-button")).not.toBeNull());
    (wrapper.element as HTMLElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
