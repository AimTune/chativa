import { describe, it, expect, beforeEach } from "vitest";
import chatStore from "../ChatStore";
import { DEFAULT_THEME } from "../../../domain/value-objects/Theme";

describe("ChatStore", () => {
  beforeEach(() => {
    // Reset to initial state
    chatStore.setState({
      isOpened: false,
      isRendered: false,
      activeConnector: "dummy",
      theme: DEFAULT_THEME,
    });
  });

  it("starts closed and not rendered", () => {
    const s = chatStore.getState();
    expect(s.isOpened).toBe(false);
    expect(s.isRendered).toBe(false);
  });

  it("open() sets isOpened and isRendered to true", () => {
    chatStore.getState().open();
    expect(chatStore.getState().isOpened).toBe(true);
    expect(chatStore.getState().isRendered).toBe(true);
  });

  it("close() sets isOpened to false", () => {
    chatStore.getState().open();
    chatStore.getState().close();
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("toggle() flips isOpened", () => {
    chatStore.getState().toggle();
    expect(chatStore.getState().isOpened).toBe(true);
    chatStore.getState().toggle();
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("toggle() sets isRendered to true", () => {
    chatStore.getState().toggle();
    expect(chatStore.getState().isRendered).toBe(true);
  });

  it("setTheme merges partial theme", () => {
    chatStore.getState().setTheme({ colors: { primary: "#ff0000" } });
    expect(chatStore.getState().theme.colors.primary).toBe("#ff0000");
    expect(chatStore.getState().theme.colors.secondary).toBe(
      DEFAULT_THEME.colors.secondary
    );
  });

  it("getTheme returns the current theme", () => {
    const theme = chatStore.getState().getTheme();
    expect(theme).toEqual(DEFAULT_THEME);
  });

  it("setConnector updates activeConnector", () => {
    chatStore.getState().setConnector("websocket");
    expect(chatStore.getState().activeConnector).toBe("websocket");
  });
});
