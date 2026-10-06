import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { conversationStore, type Conversation } from "@chativa/core";
import "../ConversationList";
import { $, $$, mount, resetGlobals } from "../../__tests__/testUtils";

const convs: Conversation[] = [
  { id: "c1", title: "Support ticket", contact: "Jane Doe", status: "open", lastMessage: "Hi there", unreadCount: 3 },
  { id: "c2", title: "billing question", status: "pending", avatar: "https://a.test/c2.png" },
  { id: "c3", title: "Old", status: "closed" },
];

function collect(type: string) {
  const events: CustomEvent[] = [];
  document.addEventListener(type, (e) => events.push(e as CustomEvent));
  return events;
}

describe("ConversationList", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  it("shows an empty state when there are no conversations", async () => {
    const el = await mount("conversation-list");
    expect($(el, ".empty")!.textContent).toBe("No conversations yet");
  });

  it("renders conversations from the store with initials, avatar, preview, badge and status", async () => {
    conversationStore.getState().setConversations(convs);
    conversationStore.getState().setActive("c1");
    const el = await mount("conversation-list");

    const items = $$(el, ".item");
    expect(items).toHaveLength(3);
    expect(items[0].classList.contains("active")).toBe(true);
    expect(items[0].getAttribute("aria-selected")).toBe("true");
    expect(items[0].querySelector(".name")!.textContent).toBe("Jane Doe");
    expect(items[0].querySelector(".avatar")!.textContent!.trim()).toBe("JD");
    expect(items[0].querySelector(".last")!.textContent).toBe("Hi there");
    expect(items[0].querySelector(".badge")!.textContent).toBe("3");

    expect(items[1].querySelector(".name")!.textContent).toBe("billing question");
    expect(items[1].querySelector(".avatar img")!.getAttribute("src")).toBe("https://a.test/c2.png");
    expect(items[1].querySelector(".badge")).toBeNull();
    expect(items[1].querySelector(".last")).toBeNull();

    expect(items[2].classList.contains("closed")).toBe(true);
    expect(items[2].querySelector(".status-dot")!.classList.contains("closed")).toBe(true);
    expect(items[2].querySelector(".avatar")!.textContent!.trim()).toBe("O");
  });

  it("re-renders when the store changes", async () => {
    const el = await mount("conversation-list");
    conversationStore.getState().setConversations(convs);
    conversationStore.getState().setActive("c2");
    await el.updateComplete;
    expect($$(el, ".item")).toHaveLength(3);
    expect($$(el, ".item")[1].classList.contains("active")).toBe(true);
  });

  it("dispatches conversation-select, new-conversation and conversation-close", async () => {
    conversationStore.getState().setConversations(convs);
    const el = await mount("conversation-list");
    const selects = collect("conversation-select");
    const news = collect("new-conversation");
    const closes = collect("conversation-close");

    $$(el, ".item")[1].click();
    $(el, ".new-btn")!.click();
    $$(el, ".close-btn")[0].click();

    expect(selects.map((e) => e.detail)).toEqual([{ id: "c2" }]); // close click does not select
    expect(news).toHaveLength(1);
    expect(closes.map((e) => e.detail)).toEqual([{ id: "c1" }]);
  });

  it("stops listening to the store once removed", async () => {
    const el = await mount("conversation-list");
    el.remove();
    conversationStore.getState().setConversations(convs);
    await el.updateComplete;
    expect($$(el, ".item")).toHaveLength(0);
  });
});
