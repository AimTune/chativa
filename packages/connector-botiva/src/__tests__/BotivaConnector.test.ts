import { describe, it, expect } from "vitest";
import { BotivaConnector } from "../index";
import type { ToolCall } from "@chativa/core";

/**
 * routeFrame() is exercised directly (no socket) — it is the single dispatch
 * point every wire frame goes through, so feeding it raw JSON is equivalent
 * to receiving the frame over any transport.
 */
function makeConnector() {
  const connector = new BotivaConnector({ url: "ws://test", reconnect: false });
  const messages: Array<Record<string, unknown>> = [];
  const toolCalls: ToolCall[] = [];
  connector.onMessage((m) => messages.push(m as unknown as Record<string, unknown>));
  connector.onToolCall((tc) => toolCalls.push(tc));
  const route = (frame: Record<string, unknown>) =>
    (connector as unknown as { routeFrame(raw: string): void }).routeFrame(
      JSON.stringify(frame),
    );
  return { connector, messages, toolCalls, route };
}

describe("BotivaConnector.routeFrame", () => {
  it("surfaces a bot text frame with actions as a quick-reply message", () => {
    const { messages, route } = makeConnector();
    route({
      type: "text",
      id: "msg-hitl",
      seq: 7,
      from: "bot",
      data: { text: 'Generate the "velocity" report as PDF?' },
      actions: [{ label: "Approve" }, { label: "Cancel" }],
      timestamp: 1234,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("quick-reply");
    expect(messages[0].id).toBe("msg-hitl");
    expect(messages[0].timestamp).toBe(1234);
    const data = messages[0].data as Record<string, unknown>;
    expect(data.text).toBe('Generate the "velocity" report as PDF?');
    expect(data.actions).toEqual([{ label: "Approve" }, { label: "Cancel" }]);
    expect(data.keepActions).toBe(true);
  });

  it("leaves a plain bot text frame untouched", () => {
    const { messages, route } = makeConnector();
    route({
      type: "text",
      id: "msg-plain",
      from: "bot",
      data: { text: "hello" },
      timestamp: 1,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("text");
  });

  it("does not remap replayed user frames even if they carry actions", () => {
    const { messages, route } = makeConnector();
    route({
      type: "text",
      id: "msg-user",
      from: "user",
      data: { text: "evet" },
      actions: [{ label: "stray" }],
      timestamp: 2,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("text");
  });

  it("routes tool_call frames to onToolCall, not onMessage", () => {
    const { messages, toolCalls, route } = makeConnector();
    route({
      type: "tool_call",
      seq: 3,
      data: { id: "t1", name: "generate_report_pdf", status: "running" },
    });
    expect(messages).toHaveLength(0);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({ id: "t1", status: "running" });
  });
});
