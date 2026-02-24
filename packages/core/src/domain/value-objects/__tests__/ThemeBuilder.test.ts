import { describe, it, expect } from "vitest";
import { ThemeBuilder } from "../ThemeBuilder";
import { DEFAULT_THEME } from "../Theme";

describe("ThemeBuilder", () => {
  it("build() without any setters returns a theme equal to DEFAULT_THEME", () => {
    const result = ThemeBuilder.create().build();
    expect(result).toEqual(DEFAULT_THEME);
  });

  it("build() does not return the exact DEFAULT_THEME reference", () => {
    const result = ThemeBuilder.create().build();
    expect(result).not.toBe(DEFAULT_THEME);
  });

  it("setPrimary() overrides colors.primary", () => {
    const result = ThemeBuilder.create().setPrimary("#ff0000").build();
    expect(result.colors.primary).toBe("#ff0000");
  });

  it("setSecondary() overrides colors.secondary", () => {
    const result = ThemeBuilder.create().setSecondary("#00ff00").build();
    expect(result.colors.secondary).toBe("#00ff00");
  });

  it("setBackground() overrides colors.background", () => {
    const result = ThemeBuilder.create().setBackground("#111111").build();
    expect(result.colors.background).toBe("#111111");
  });

  it("setText() overrides colors.text", () => {
    const result = ThemeBuilder.create().setText("#222222").build();
    expect(result.colors.text).toBe("#222222");
  });

  it("setBorder() overrides colors.border", () => {
    const result = ThemeBuilder.create().setBorder("#333333").build();
    expect(result.colors.border).toBe("#333333");
  });

  it("setColors() merges only provided color fields", () => {
    const result = ThemeBuilder.create()
      .setColors({ primary: "#aaa", secondary: "#bbb" })
      .build();
    expect(result.colors.primary).toBe("#aaa");
    expect(result.colors.secondary).toBe("#bbb");
    // background unchanged
    expect(result.colors.background).toBe(DEFAULT_THEME.colors.background);
  });

  it("setColors() does not clobber colors set by earlier setter", () => {
    const result = ThemeBuilder.create()
      .setPrimary("#111")
      .setColors({ secondary: "#222" })
      .build();
    expect(result.colors.primary).toBe("#111");
    expect(result.colors.secondary).toBe("#222");
  });

  it("setPosition() sets the button position", () => {
    const result = ThemeBuilder.create().setPosition("top-left").build();
    expect(result.position).toBe("top-left");
  });

  it("setSize() sets the button size", () => {
    const result = ThemeBuilder.create().setSize("large").build();
    expect(result.size).toBe("large");
  });

  it("setPositionMargin() sets positionMargin", () => {
    const result = ThemeBuilder.create().setPositionMargin("4").build();
    expect(result.positionMargin).toBe("4");
  });

  it("setLayout() merges layout fields", () => {
    const result = ThemeBuilder.create().setLayout({ width: "480px" }).build();
    expect(result.layout.width).toBe("480px");
  });

  it("setLayout() does not clobber unprovided layout fields", () => {
    const result = ThemeBuilder.create().setLayout({ width: "480px" }).build();
    expect(result.layout.height).toBe(DEFAULT_THEME.layout.height);
  });

  it("setAvatar() sets the avatar config", () => {
    const avatar = { bot: "https://example.com/bot.png", showBot: true, showUser: false };
    const result = ThemeBuilder.create().setAvatar(avatar).build();
    expect(result.avatar).toEqual(avatar);
  });

  it("setShowMessageStatus() sets the showMessageStatus flag", () => {
    const result = ThemeBuilder.create().setShowMessageStatus(true).build();
    expect(result.showMessageStatus).toBe(true);
  });

  it("fluent chain produces correct result", () => {
    const result = ThemeBuilder.create()
      .setPrimary("#e11d48")
      .setSize("large")
      .setPosition("bottom-left")
      .setShowMessageStatus(true)
      .build();

    expect(result.colors.primary).toBe("#e11d48");
    expect(result.size).toBe("large");
    expect(result.position).toBe("bottom-left");
    expect(result.showMessageStatus).toBe(true);
  });

  it("build() does not mutate DEFAULT_THEME", () => {
    const originalPrimary = DEFAULT_THEME.colors.primary;
    ThemeBuilder.create().setPrimary("#deadbeef").build();
    expect(DEFAULT_THEME.colors.primary).toBe(originalPrimary);
  });

  it("two independent builders do not share state", () => {
    const a = ThemeBuilder.create().setPrimary("#aaaaaa");
    const b = ThemeBuilder.create().setPrimary("#bbbbbb");
    expect(a.build().colors.primary).toBe("#aaaaaa");
    expect(b.build().colors.primary).toBe("#bbbbbb");
  });
});
