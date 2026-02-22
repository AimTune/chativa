import { describe, it, expect } from "vitest";
import { DEFAULT_THEME, mergeTheme, themeToCSS } from "../Theme";

describe("DEFAULT_THEME", () => {
  it("has a primary color", () => {
    expect(DEFAULT_THEME.colors.primary).toBeTruthy();
  });

  it("has bottom-right as default position", () => {
    expect(DEFAULT_THEME.position).toBe("bottom-right");
  });

  it("has medium size by default", () => {
    expect(DEFAULT_THEME.size).toBe("medium");
  });
});

describe("mergeTheme", () => {
  it("overrides a top-level color", () => {
    const result = mergeTheme(DEFAULT_THEME, {
      colors: { primary: "#ff0000" },
    });
    expect(result.colors.primary).toBe("#ff0000");
  });

  it("preserves non-overridden colors", () => {
    const result = mergeTheme(DEFAULT_THEME, {
      colors: { primary: "#ff0000" },
    });
    expect(result.colors.secondary).toBe(DEFAULT_THEME.colors.secondary);
  });

  it("overrides layout fields", () => {
    const result = mergeTheme(DEFAULT_THEME, {
      layout: { width: "400px" },
    });
    expect(result.layout.width).toBe("400px");
    expect(result.layout.height).toBe(DEFAULT_THEME.layout.height);
  });

  it("overrides position", () => {
    const result = mergeTheme(DEFAULT_THEME, { position: "top-left" });
    expect(result.position).toBe("top-left");
  });

  it("does not mutate the base theme", () => {
    const before = { ...DEFAULT_THEME.colors };
    mergeTheme(DEFAULT_THEME, { colors: { primary: "#123456" } });
    expect(DEFAULT_THEME.colors.primary).toBe(before.primary);
  });
});

describe("themeToCSS", () => {
  it("maps primary color to CSS variable", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(css["--chativa-primary-color"]).toBe(DEFAULT_THEME.colors.primary);
  });

  it("maps all five color variables", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(Object.keys(css)).toHaveLength(5);
  });
});
