import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Captures the props the component hands to the native WebView so the test
// can drive its `onMessage` handler directly — no RN runtime needed.
const captured: { props: Record<string, unknown> | null } = { props: null };

vi.mock("react-native-webview", () => ({
  default: (props: Record<string, unknown>) => {
    captured.props = props;
    return null;
  },
}));

import { ChativaWebView, type ChativaWebViewProps } from "../ChativaWebView";

type CallbackName =
  | "onReady"
  | "onMessage"
  | "onMessageSent"
  | "onConnect"
  | "onDisconnect"
  | "onSurveySubmit"
  | "onWidgetOpen"
  | "onWidgetClose"
  | "onGenUIComponentsRegistered"
  | "onGenUIStreamStarted"
  | "onGenUIStreamCompleted"
  | "onToolCallUpdated"
  | "onAuthError"
  | "onError";

function makeCallbacks() {
  return {
    onReady: vi.fn(),
    onMessage: vi.fn(),
    onMessageSent: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onSurveySubmit: vi.fn(),
    onWidgetOpen: vi.fn(),
    onWidgetClose: vi.fn(),
    onGenUIComponentsRegistered: vi.fn(),
    onGenUIStreamStarted: vi.fn(),
    onGenUIStreamCompleted: vi.fn(),
    onToolCallUpdated: vi.fn(),
    onAuthError: vi.fn(),
    onError: vi.fn(),
  } satisfies Record<CallbackName, unknown>;
}

type Callbacks = ReturnType<typeof makeCallbacks>;
type CapturedProps = Record<string, unknown>;

function render(props: Partial<ChativaWebViewProps> = {}): CapturedProps {
  renderToStaticMarkup(<ChativaWebView connector={{ type: "dummy" }} locale="tr" {...props} />);
  if (!captured.props) throw new Error("WebView was not rendered");
  return captured.props;
}

function send(props: CapturedProps, data: unknown) {
  const onMessage = props.onMessage as (e: { nativeEvent: { data: string } }) => void;
  onMessage({ nativeEvent: { data: typeof data === "string" ? data : JSON.stringify(data) } });
}

function expectOnlyCalled(cbs: Callbacks, name: CallbackName) {
  for (const [key, fn] of Object.entries(cbs)) {
    if (key === name) expect(fn, key).toHaveBeenCalledTimes(1);
    else expect(fn, key).not.toHaveBeenCalled();
  }
}

function expectNoneCalled(cbs: Callbacks) {
  for (const [key, fn] of Object.entries(cbs)) expect(fn, key).not.toHaveBeenCalled();
}

beforeEach(() => {
  captured.props = null;
});

describe("ChativaWebView — WebView props", () => {
  it("renders the bootstrap html built from the connector/theme/locale settings", () => {
    const style = { flex: 1 };
    const props = render({
      connector: { type: "websocket", options: { url: "wss://h/ws" } },
      theme: { colors: { primary: "#f00" } },
      cdnBaseUrl: "https://cdn.example.com",
      versions: { ui: "1.2.3" },
      style,
    });
    const source = props.source as { html: string };
    expect(source.html).toContain("https://cdn.example.com/@chativa/ui@1.2.3/dist/chativa.global.js");
    expect(source.html).toContain("chativa-websocket.global.js");
    expect(source.html).toContain('"wss://h/ws"');
    expect(source.html).toContain('"#f00"');
    expect(source.html).toContain('locale: "tr"');
    expect(props.style).toBe(style);
    expect(props.originWhitelist).toEqual(["*"]);
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.domStorageEnabled).toBe(true);
    expect(props.mixedContentMode).toBe("always");
    expect(typeof props.onMessage).toBe("function");
  });
});

describe("ChativaWebView — bridge message dispatch", () => {
  const cases: Array<{ name: CallbackName; msg: { type: string; payload?: unknown }; arg?: unknown }> = [
    { name: "onReady", msg: { type: "ready" } },
    {
      name: "onMessage",
      msg: { type: "message_received", payload: { id: "m1", type: "text", data: { text: "hi" } } },
      arg: { id: "m1", type: "text", data: { text: "hi" } },
    },
    {
      name: "onMessageSent",
      msg: { type: "message_sent", payload: { id: "o1", type: "text", data: { text: "yo" } } },
      arg: { id: "o1", type: "text", data: { text: "yo" } },
    },
    { name: "onConnect", msg: { type: "connector_status_changed", payload: { status: "connected" } } },
    {
      name: "onDisconnect",
      msg: { type: "connector_status_changed", payload: { status: "disconnected" } },
      arg: { status: "disconnected" },
    },
    { name: "onSurveySubmit", msg: { type: "survey_submitted", payload: { rating: 5 } }, arg: { rating: 5 } },
    { name: "onWidgetOpen", msg: { type: "widget_opened" } },
    { name: "onWidgetClose", msg: { type: "widget_closed" } },
    {
      name: "onGenUIComponentsRegistered",
      msg: { type: "genui_components_registered", payload: { components: [{ name: "card", version: "1" }] } },
      arg: { components: [{ name: "card", version: "1" }] },
    },
    {
      name: "onGenUIStreamStarted",
      msg: { type: "genui_stream_started", payload: { streamId: "s1" } },
      arg: { streamId: "s1" },
    },
    {
      name: "onGenUIStreamCompleted",
      msg: { type: "genui_stream_completed", payload: { streamId: "s1" } },
      arg: { streamId: "s1" },
    },
    {
      name: "onToolCallUpdated",
      msg: { type: "tool_call_updated", payload: { id: "t1", name: "search", status: "running" } },
      arg: { id: "t1", name: "search", status: "running" },
    },
    {
      name: "onAuthError",
      msg: { type: "auth_error", payload: { code: "unauthorized", message: "nope" } },
      arg: { code: "unauthorized", message: "nope" },
    },
    { name: "onError", msg: { type: "error", payload: { message: "boom" } }, arg: "boom" },
  ];

  for (const { name, msg, arg } of cases) {
    it(`"${msg.type}" fires ${name}`, () => {
      const cbs = makeCallbacks();
      send(render(cbs), msg);
      expectOnlyCalled(cbs, name);
      if (arg !== undefined) expect(cbs[name]).toHaveBeenCalledWith(arg);
    });
  }

  it('connector status "error" fires onDisconnect with the payload', () => {
    const cbs = makeCallbacks();
    send(render(cbs), { type: "connector_status_changed", payload: { status: "error" } });
    expectOnlyCalled(cbs, "onDisconnect");
    expect(cbs.onDisconnect).toHaveBeenCalledWith({ status: "error" });
  });

  it('connector status "connecting" fires neither onConnect nor onDisconnect', () => {
    const cbs = makeCallbacks();
    send(render(cbs), { type: "connector_status_changed", payload: { status: "connecting" } });
    expectNoneCalled(cbs);
  });

  it("ignores invalid JSON", () => {
    const cbs = makeCallbacks();
    const props = render(cbs);
    expect(() => send(props, "{not json")).not.toThrow();
    expectNoneCalled(cbs);
  });

  it("ignores unknown message types", () => {
    const cbs = makeCallbacks();
    send(render(cbs), { type: "something_else" });
    expectNoneCalled(cbs);
  });

  it("tolerates every message type when no callbacks are supplied", () => {
    const props = render();
    for (const { msg } of cases) expect(() => send(props, msg)).not.toThrow();
    expect(() => send(props, { type: "connector_status_changed", payload: { status: "error" } })).not.toThrow();
  });
});
