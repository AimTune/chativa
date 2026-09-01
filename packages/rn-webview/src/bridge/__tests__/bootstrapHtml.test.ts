import { describe, it, expect } from "vitest";
import { buildBootstrapHtml } from "../bootstrapHtml";
import type { ChativaConnectorSpec } from "../types";

const dummySpec: ChativaConnectorSpec = { type: "dummy" };

function html(connector: ChativaConnectorSpec, extra?: { versions?: Record<string, string> }) {
  return buildBootstrapHtml({ settings: { connector }, versions: extra?.versions });
}

describe("buildBootstrapHtml — script loading", () => {
  it("loads the connector script and the ui bundle, but no separate core script", () => {
    const out = html(dummySpec);
    expect(out).toContain("@chativa/connector-dummy@latest/dist/chativa-dummy.global.js");
    expect(out).toContain("@chativa/ui@latest/dist/chativa.global.js");
    // The ui bundle carries its own copy of core; loading chativa-core.global.js
    // separately would create a second, disconnected EventBus/chatStore.
    expect(out).not.toContain("chativa-core.global.js");
  });

  it("pins versions per package", () => {
    const out = buildBootstrapHtml({
      settings: { connector: { type: "mekik", options: { url: "ws://h/chat" } } },
      versions: { ui: "0.10.0", mekik: "0.0.1" },
    });
    expect(out).toContain("@chativa/ui@0.10.0/dist/chativa.global.js");
    expect(out).toContain("@chativa/connector-mekik@0.0.1/dist/chativa-mekik.global.js");
  });
});

describe("buildBootstrapHtml — singleton bridge binding", () => {
  it("binds EventBus/chatStore from window.Chativa (the widget's own instances)", () => {
    const out = html(dummySpec);
    expect(out).toContain("var C = window.Chativa;");
    expect(out).not.toContain("window.ChativaCore");
  });

  it("fails loudly when the ui bundle is too old to expose the singletons", () => {
    const out = html(dummySpec);
    expect(out).toContain("@chativa/ui >= 0.10 required");
  });
});

describe("buildBootstrapHtml — mekik connector", () => {
  it("constructs MekikConnector from the ChativaMekik global", () => {
    const out = html({ type: "mekik", options: { url: "ws://h/chat", resumeConversation: true } });
    expect(out).toContain('window["ChativaMekik"]');
    expect(out).toContain("new g.MekikConnector(o)");
    expect(out).toContain('"resumeConversation":true');
  });

  it("rebuilds token auth as a real TokenAuth instance (kind stripped)", () => {
    const out = html({
      type: "mekik",
      options: { url: "ws://h/chat", auth: { kind: "token", token: "t-1", transport: "query" } },
    });
    expect(out).toContain('o.auth = new g.TokenAuth({"token":"t-1","transport":"query"});');
    expect(out).not.toContain('"kind"');
  });

  it("rebuilds cookie auth as CookieAuth", () => {
    const out = html({ type: "mekik", options: { url: "ws://h/chat", auth: { kind: "cookie" } } });
    expect(out).toContain("o.auth = new g.CookieAuth();");
  });

  it("sets no auth when the spec has none, and always bridges onAuthError", () => {
    const out = html({ type: "mekik", options: { url: "ws://h/chat" } });
    expect(out).not.toContain("o.auth =");
    expect(out).toContain('o.onAuthError = function (e) { post({ type: "auth_error"');
  });

  it("passes the plain-string token shorthand through untouched", () => {
    const out = html({ type: "mekik", options: { url: "ws://h/chat", token: "legacy" } });
    expect(out).toContain('"token":"legacy"');
  });
});

describe("buildBootstrapHtml — GenUI bridging", () => {
  it("forwards GenUI and tool-call EventBus events to React Native", () => {
    const out = html(dummySpec);
    expect(out).toContain('EventBus.on("genui_components_registered"');
    expect(out).toContain('EventBus.on("genui_stream_started"');
    expect(out).toContain('EventBus.on("genui_stream_completed"');
    expect(out).toContain('EventBus.on("tool_call_updated"');
    // Summaries only — the full template/css stays inside the WebView.
    expect(out).toContain("{ name: d.name, version: d.version, tag: d.tag }");
  });
});

describe("buildBootstrapHtml — inbound commands", () => {
  it("handles set_theme, send_message, open_widget and close_widget", () => {
    const out = html(dummySpec);
    expect(out).toContain('case "set_theme":');
    expect(out).toContain('case "send_message":');
    expect(out).toContain('case "open_widget":');
    expect(out).toContain('case "close_widget":');
    expect(out).toContain('new CustomEvent("chat-action"');
  });
});

describe("buildBootstrapHtml — inline JSON safety", () => {
  it("escapes </script> inside option values so it can't break out of the block", () => {
    const out = html({ type: "dummy", options: { greeting: "</script><script>alert(1)</script>" } });
    expect(out).not.toContain("</script><script>alert(1)");
    expect(out).toContain("\\u003c/script>");
  });
});
