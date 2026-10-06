import { describe, it, expect, vi } from "vitest";

// Simulate the optional peer dependency being absent: the dynamic import fails.
vi.mock("@microsoft/signalr", () => {
  throw new Error("Cannot find module '@microsoft/signalr'");
});

const { SignalRConnector } = await import("../SignalRConnector");

describe("SignalRConnector without @microsoft/signalr", () => {
  it("rejects connect with an install hint", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    const onConnect = vi.fn();
    connector.onConnect(onConnect);

    await expect(connector.connect()).rejects.toThrow(
      "SignalRConnector: @microsoft/signalr not installed. Run: npm install @microsoft/signalr",
    );
    expect(onConnect).not.toHaveBeenCalled();
  });
});
