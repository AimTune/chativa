import { describe, it, expect, beforeEach } from "vitest";
import { LinkPreviewExtension } from "../LinkPreviewExtension";
import { ExtensionRegistry } from "../../registries/ExtensionRegistry";
import type { IncomingMessage } from "../../../domain/entities/Message";

function makeMessage(text: string, type = "text"): IncomingMessage {
  return { id: "1", type, data: { text } };
}

describe("LinkPreviewExtension", () => {
  beforeEach(() => {
    ExtensionRegistry.clear();
  });

  it("extracts a single URL from incoming text", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("Check this: https://example.com")
    );
    expect(result?.data.urls).toEqual(["https://example.com"]);
  });

  it("extracts multiple URLs", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("See https://a.com and https://b.com")
    );
    expect(result?.data.urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("deduplicates identical URLs", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("https://a.com https://a.com")
    );
    expect(result?.data.urls).toEqual(["https://a.com"]);
  });

  it("strips trailing punctuation from URLs", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("Visit https://example.com.")
    );
    expect(result?.data.urls).toEqual(["https://example.com"]);
  });

  it("limits URLs to maxUrlsPerMessage", () => {
    ExtensionRegistry.install(new LinkPreviewExtension({ maxUrlsPerMessage: 2 }));
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("https://a.com https://b.com https://c.com")
    );
    expect(result?.data.urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("does not modify messages without URLs", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(makeMessage("Hello world"));
    expect(result?.data.urls).toBeUndefined();
  });

  it("ignores non-text messages", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const msg: IncomingMessage = {
      id: "1",
      type: "image",
      data: { text: "https://example.com" },
    };
    const result = ExtensionRegistry.runAfterReceive(msg);
    expect(result?.data.urls).toBeUndefined();
  });

  it("accepts a custom URL extractor", () => {
    const customExtractor = (text: string) =>
      text.includes("SPECIAL") ? ["https://custom.com"] : [];

    ExtensionRegistry.install(
      new LinkPreviewExtension({ urlExtractor: customExtractor })
    );
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("SPECIAL link here")
    );
    expect(result?.data.urls).toEqual(["https://custom.com"]);
  });

  it("preserves existing message data fields", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const msg: IncomingMessage = {
      id: "1",
      type: "text",
      data: { text: "https://example.com", custom: "value" },
    };
    const result = ExtensionRegistry.runAfterReceive(msg);
    expect(result?.data.custom).toBe("value");
    expect(result?.data.urls).toEqual(["https://example.com"]);
  });

  it("handles http URLs", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("http://insecure.com/page")
    );
    expect(result?.data.urls).toEqual(["http://insecure.com/page"]);
  });

  it("handles empty text", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(makeMessage(""));
    expect(result?.data.urls).toBeUndefined();
  });

  it("skips URL extraction when preview is false", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const msg: IncomingMessage = {
      id: "1",
      type: "text",
      data: { text: "https://example.com", preview: false },
    };
    const result = ExtensionRegistry.runAfterReceive(msg);
    expect(result?.data.urls).toBeUndefined();
  });

  it("sets previewVariant to expanded when preview is 'expanded'", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const msg: IncomingMessage = {
      id: "1",
      type: "text",
      data: { text: "https://example.com", preview: "expanded" },
    };
    const result = ExtensionRegistry.runAfterReceive(msg);
    expect(result?.data.urls).toEqual(["https://example.com"]);
    expect(result?.data.previewVariant).toBe("expanded");
  });

  it("defaults previewVariant to compact", () => {
    ExtensionRegistry.install(new LinkPreviewExtension());
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("https://example.com")
    );
    expect(result?.data.previewVariant).toBe("compact");
  });

  it("uses defaultVariant option when set to expanded", () => {
    ExtensionRegistry.install(new LinkPreviewExtension({ defaultVariant: "expanded" }));
    const result = ExtensionRegistry.runAfterReceive(
      makeMessage("https://example.com")
    );
    expect(result?.data.previewVariant).toBe("expanded");
  });
});
