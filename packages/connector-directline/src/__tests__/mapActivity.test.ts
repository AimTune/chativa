import { describe, expect, it } from "vitest";
import type { Activity } from "botframework-directlinejs";
import { mapActivityToMessage } from "../mapActivity";

describe("mapActivityToMessage — Adaptive Card fallback text", () => {
  it("preserves Markdown links and paragraph breaks for button messages", () => {
    const fallbackText =
      "Read [here](https://example.com/privacy).\n\nAre you a customer?";
    const activity = {
      type: "message",
      id: "activity-1",
      from: { id: "bot" },
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            type: "AdaptiveCard",
            version: "1.3",
            fallbackText,
            body: [{ type: "TextBlock", text: "Read here." }],
            actions: [{ type: "Action.Submit", title: "Yes", data: "Yes" }],
          },
        },
      ],
    } as Activity;

    const result = mapActivityToMessage(activity, "user-1");

    expect(result).not.toBeNull();
    expect(result).not.toBeTypeOf("symbol");
    if (!result || typeof result === "symbol") return;
    expect(result.type).toBe("buttons");
    expect(result.data.text).toBe(fallbackText);
  });
});
