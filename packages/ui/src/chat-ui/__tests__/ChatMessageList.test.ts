import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chatStore, messageStore } from "@chativa/core";
import "../ChatMessageList";

type TestMessageList = HTMLElement & { updateComplete: Promise<unknown> };

const DISCLAIMER_TEXT = "This assistant uses AI-generated responses.";

function createMessageList(): TestMessageList {
  const element = document.createElement("chat-message-list") as TestMessageList;
  document.body.appendChild(element);
  return element;
}

describe("ChatMessageList — conversation disclaimer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    messageStore.getState().clear();
    chatStore.getState().setConnectorStatus("connecting");
    chatStore.getState().setTheme({
      disclaimer: {
        enabled: true,
        conversationStartText: DISCLAIMER_TEXT,
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    messageStore.getState().clear();
    chatStore.getState().setTheme({
      disclaimer: {
        enabled: false,
        bottomText: "",
        conversationStartText: "",
      },
    });
  });

  it("shows the notice as soon as the bot starts connecting", async () => {
    const element = createMessageList();
    await element.updateComplete;

    const notice = element.shadowRoot?.querySelector(".conversation-disclaimer");
    expect(notice?.textContent?.trim()).toBe(DISCLAIMER_TEXT);
    expect(element.shadowRoot?.querySelector(".connecting")).not.toBeNull();
  });

  it("keeps the notice before the first greeting message", async () => {
    const element = createMessageList();
    await element.updateComplete;

    chatStore.getState().setConnectorStatus("connected");
    messageStore.getState().addMessage({
      id: "greeting-1",
      type: "text",
      from: "bot",
      data: { text: "Welcome" },
    });
    await element.updateComplete;

    const list = element.shadowRoot?.querySelector(".list");
    const notice = list?.querySelector(".conversation-disclaimer");
    const greeting = list?.querySelector("default-text-message");

    expect(notice).not.toBeNull();
    expect(greeting).not.toBeNull();
    expect(
      notice!.compareDocumentPosition(greeting!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
