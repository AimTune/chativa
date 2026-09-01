import { describe, expect, it } from "vitest";
import { resolveDisclaimerContent } from "../disclaimerContent";

describe("resolveDisclaimerContent", () => {
  it("supports bottom and conversation-start text at the same time", () => {
    expect(
      resolveDisclaimerContent(
        {
          enabled: true,
          bottomText: "Short footer notice",
          conversationStartText: "Detailed conversation notice",
        },
      ),
    ).toEqual({
      bottomText: "Short footer notice",
      conversationStartText: "Detailed conversation notice",
    });
  });

  it("does not enable an unspecified position", () => {
    expect(
      resolveDisclaimerContent(
        { enabled: true, conversationStartText: "Start only" },
      ),
    ).toEqual({
      bottomText: "",
      conversationStartText: "Start only",
    });
  });

  it("returns no content when the feature is disabled", () => {
    expect(resolveDisclaimerContent({
      enabled: false,
      bottomText: "Bottom",
      conversationStartText: "Start",
    })).toEqual({
      bottomText: "",
      conversationStartText: "",
    });
  });
});
