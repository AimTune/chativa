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

describe("ChatMessageList — feedback buttons", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    messageStore.getState().clear();
    chatStore.getState().setConnectorStatus("connected");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    messageStore.getState().clear();
  });

  async function renderWith(...messages: Parameters<ReturnType<typeof messageStore.getState>["addMessage"]>[0][]) {
    const element = createMessageList();
    for (const m of messages) messageStore.getState().addMessage(m);
    await element.updateComplete;
    return element;
  }

  it("renders feedback under every bot message type, not just text", async () => {
    const element = await renderWith(
      { id: "t1", type: "text", from: "bot", data: { text: "Hi" } },
      { id: "b1", type: "buttons", from: "bot", data: { text: "Pick", buttons: [{ label: "A" }] } },
      { id: "c1", type: "card", from: "bot", data: { title: "Card" } },
    );

    const feedback = [...element.shadowRoot!.querySelectorAll("message-feedback")] as (HTMLElement & {
      messageId: string;
    })[];
    expect(feedback.map((f) => f.messageId)).toEqual(["t1", "b1", "c1"]);
  });

  it("does not render feedback under user messages", async () => {
    const element = await renderWith({ id: "u1", type: "text", from: "user", data: { text: "Hello" } });
    expect(element.shadowRoot!.querySelector("message-feedback")).toBeNull();
  });

  it("dispatches chativa-feedback with the message id", async () => {
    const element = await renderWith(
      { id: "b2", type: "buttons", from: "bot", data: { buttons: [{ label: "A" }] } },
    );
    const feedback = element.shadowRoot!.querySelector("message-feedback") as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await feedback.updateComplete;

    const events: CustomEvent[] = [];
    document.body.addEventListener("chativa-feedback", (e) => events.push(e as CustomEvent));
    (feedback.shadowRoot!.querySelector(".feedback-btn") as HTMLButtonElement).click();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ messageId: "b2", feedback: "like" });
  });

  it("locks the buttons when the bot disabled feedback", async () => {
    const element = await renderWith(
      { id: "d1", type: "text", from: "bot", data: { text: "Hi", feedbackDisabled: true, feedbackType: 1 } },
    );
    const feedback = element.shadowRoot!.querySelector("message-feedback") as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await feedback.updateComplete;

    const buttons = [...feedback.shadowRoot!.querySelectorAll("button")];
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(feedback.hasAttribute("active")).toBe(true);
  });
});
