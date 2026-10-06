import { describe, it, expect, afterEach } from "vitest";
import { mount, type Wrapper } from "@vue/test-utils";
import type Vue from "vue";
import { GenUIMessage } from "../GenUIMessage";
import { attachPoint, mountable, waitFor } from "./helpers";

let wrapper: Wrapper<Vue> | null = null;

afterEach(() => {
  wrapper?.destroy();
  wrapper = null;
  document.body.innerHTML = "";
});

type GenUIEl = HTMLElement & {
  messageData: Record<string, unknown>;
  sender: string;
  messageId: string;
  hideAvatar: boolean;
  debug: boolean;
  status: string;
};

const waitForElement = () =>
  waitFor(() => expect(document.querySelector("genui-message")).not.toBeNull());

describe("GenUIMessage", () => {
  it("forwards object and boolean props as DOM properties", async () => {
    const messageData = { chunks: [{ type: "text", content: "hi", id: 1 }], streamingComplete: true };
    wrapper = mount(mountable(GenUIMessage), {
      attachTo: attachPoint(),
      propsData: { messageData, sender: "bot", messageId: "g1", hideAvatar: true, debug: true },
    });
    expect(document.querySelector("genui-message")).toBeNull();
    await waitForElement();

    const el = wrapper.element as GenUIEl;
    // Same object identity — a property, not a stringified attribute.
    expect(el.messageData).toBe(messageData);
    expect(el.hasAttribute("message-data")).toBe(false);
    expect(el.messageId).toBe("g1");
    expect(el.hideAvatar).toBe(true);
    expect(el.debug).toBe(true);
  });

  it("leaves unset props at the element's own defaults", async () => {
    wrapper = mount(mountable(GenUIMessage), { attachTo: attachPoint(), propsData: { messageId: "g2" } });
    await waitForElement();
    const el = wrapper.element as GenUIEl;
    expect(el.status).toBe("sent");
    expect(el.sender).toBe("bot");
    expect(el.hideAvatar).toBe(false);
  });

  it("updates the element property when a prop changes", async () => {
    wrapper = mount(mountable(GenUIMessage), { attachTo: attachPoint(), propsData: { messageId: "g3", hideAvatar: false } });
    await waitForElement();
    await wrapper.setProps({ hideAvatar: true });
    expect((wrapper.element as GenUIEl).hideAvatar).toBe(true);
  });

  it("re-emits genui-send-event and chat-action CustomEvent payloads", async () => {
    wrapper = mount(mountable(GenUIMessage), { attachTo: attachPoint(), propsData: { messageId: "g4" } });
    await waitForElement();

    const detail = { msgId: "g4", eventType: "poll_vote", payload: { option: "A" } };
    wrapper.element.dispatchEvent(new CustomEvent("genui-send-event", { detail }));
    wrapper.element.dispatchEvent(new CustomEvent("chat-action", { detail: "yes" }));

    expect(wrapper.emitted("send-event")?.[0]).toEqual([detail]);
    expect(wrapper.emitted("action")?.[0]).toEqual(["yes"]);
  });
});
