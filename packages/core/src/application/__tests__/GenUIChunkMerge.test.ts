import { describe, it, expect, beforeEach } from "vitest";
import type { AIChunk, GenUIStreamState } from "../../domain/entities/GenUI";
import type { IConnector, MessageHandler } from "../../domain/ports/IConnector";
import type { GenUIChunkHandler } from "../../domain/entities/GenUI";
import { ChatEngine } from "../ChatEngine";
import messageStore from "../stores/MessageStore";
import { MessageTypeRegistry } from "../registries/MessageTypeRegistry";

/**
 * How a stream's chunks accumulate into one GenUI message.
 *
 * The rule under test: a `ui` chunk re-sent under an id already in the list
 * replaces it. Appending instead put two entries on screen for one element, and
 * because the renderer keys instances by chunk id, the same DOM node was asked
 * to occupy both positions — so the earlier one rendered empty and the widget
 * looked like it had disappeared (or been replaced by the next component).
 */
class FakeConnector implements IConnector {
  readonly name = "fake";
  private genUI: GenUIChunkHandler | null = null;

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async sendMessage(): Promise<void> {}
  onMessage(_cb: MessageHandler): void {}
  onConnect(): void {}
  onDisconnect(): void {}
  onTyping(): void {}
  onGenUIChunk(cb: GenUIChunkHandler): void {
    this.genUI = cb;
  }

  /** Drive one chunk down the same path a real connector uses. */
  emit(chunk: AIChunk, done = false): void {
    this.genUI?.("stream-1", chunk, done);
  }
}

const ui = (id: string | number, component: string, props: Record<string, unknown>): AIChunk =>
  ({ type: "ui", component, props, id } as unknown as AIChunk);

/** Props of a `ui` chunk, without a cast at every call site. */
const propsOf = (chunk: AIChunk | undefined): Record<string, unknown> =>
  chunk && chunk.type === "ui" ? chunk.props : {};

const componentOf = (chunk: AIChunk | undefined): string | undefined =>
  chunk && chunk.type === "ui" ? chunk.component : undefined;

const chunksOf = (): AIChunk[] => {
  const msg = messageStore.getState().messages.find((m) => m.type === "genui");
  return ((msg?.data as unknown as GenUIStreamState) ?? { chunks: [] }).chunks;
};

let connector: FakeConnector;

beforeEach(async () => {
  // The engine resolves a renderer for every message it creates; core tests
  // register no components, so stand in for the ones @chativa/genui provides.
  MessageTypeRegistry.register("genui", class extends HTMLElement {} as unknown as never);
  MessageTypeRegistry.register("text", class extends HTMLElement {} as unknown as never);
  messageStore.getState().clear();
  connector = new FakeConnector();
  await new ChatEngine(connector).init();
});

describe("GenUI chunk merging", () => {
  it("keeps one entry per ui chunk id and applies the newest props", () => {
    connector.emit(ui("card-1", "order-card", { status: "Preparing" }));
    connector.emit(ui("card-1", "order-card", { status: "In transit" }));

    const chunks = chunksOf();
    expect(chunks).toHaveLength(1);
    expect(propsOf(chunks[0]).status).toBe("In transit");
  });

  it("keeps distinct components side by side while each updates in place", () => {
    connector.emit(ui("card-1", "order-card", { status: "Preparing" }));
    connector.emit(ui("card-1", "order-card", { status: "In transit" }));
    connector.emit(ui("strip-1", "shipment-strip", { step: "Picked up" }));
    connector.emit(ui("strip-1", "shipment-strip", { step: "Out for delivery" }));

    const chunks = chunksOf();
    expect(chunks.map(componentOf)).toEqual([
      "order-card",
      "shipment-strip",
    ]);
    expect(propsOf(chunks[0]).status).toBe("In transit");
    expect(propsOf(chunks[1]).step).toBe("Out for delivery");
  });

  it("holds an updated chunk in its original position", () => {
    connector.emit(ui("a", "genui-alert", { message: "first" }));
    connector.emit(ui("b", "genui-progress", { value: 10 }));
    connector.emit(ui("a", "genui-alert", { message: "updated" }));

    const chunks = chunksOf();
    expect(chunks).toHaveLength(2);
    expect(propsOf(chunks[0]).message).toBe("updated");
    expect(componentOf(chunks[1])).toBe("genui-progress");
  });

  it("updates the component too when an id is reused for a different one", () => {
    connector.emit(ui("slot", "genui-progress", { value: 10 }));
    connector.emit(ui("slot", "genui-alert", { message: "done" }));

    const chunks = chunksOf();
    expect(chunks).toHaveLength(1);
    expect(componentOf(chunks[0])).toBe("genui-alert");
  });

  it("appends event chunks rather than collapsing them by id", () => {
    connector.emit(ui("card-1", "order-card", { status: "Preparing" }));
    connector.emit({ type: "event", name: "step_done", id: 1 } as AIChunk);
    connector.emit({ type: "event", name: "step_done", id: 2 } as AIChunk);

    expect(chunksOf().filter((c) => c.type === "event")).toHaveLength(2);
  });

  it("survives the whole tracker sequence — 6 chunks, 2 elements", () => {
    // The exact shape of examples/server-components: four pre-pause chunks, then
    // two more after the human answers the chips.
    connector.emit(ui("order-card-1", "order-card", { status: "Preparing" }));
    connector.emit(ui("order-card-1", "order-card", { status: "In transit" }));
    connector.emit(ui("shipment-strip-1", "shipment-strip", { step: "Picked up" }));
    connector.emit(ui("shipment-strip-1", "shipment-strip", { step: "Out for delivery" }));
    connector.emit(ui("order-card-1", "order-card", { status: "Delivered" }));
    connector.emit(ui("shipment-strip-1", "shipment-strip", { step: "Delivered" }));

    const chunks = chunksOf();
    expect(chunks).toHaveLength(2);
    expect(propsOf(chunks[0]).status).toBe("Delivered");
    expect(propsOf(chunks[1]).step).toBe("Delivered");
  });
});
