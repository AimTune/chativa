import "./zone-testbed";
import { describe, it, expect, afterEach, vi } from "vitest";
import { Component } from "@angular/core";
import { TestBed, type ComponentFixture } from "@angular/core/testing";
import {
  ConnectorRegistry,
  EventBus,
  chatStore,
  type IConnector,
  type IncomingMessage,
} from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import { ChatIvaComponent } from "../chat-iva.component";
import { makeFakeConnector, waitFor } from "./helpers";

@Component({
  standalone: true,
  imports: [ChatIvaComponent],
  template: `
    <chativa-chat-iva
      [connector]="connector"
      (message)="onMessage($event)"
      (connect)="onConnect()"
      (disconnect)="onDisconnect($event)"
      (widgetOpen)="onWidgetOpen()"
      (chativaReset)="onReset()"
    ><span class="projected">hi</span></chativa-chat-iva>
  `,
})
class HostComponent {
  connector: string | IConnector = "dummy";
  onMessage = vi.fn<(m: IncomingMessage) => void>();
  onConnect = vi.fn();
  onDisconnect = vi.fn();
  onWidgetOpen = vi.fn();
  onReset = vi.fn();
}

function createHost(connector: string | IConnector): ComponentFixture<HostComponent> {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.connector = connector;
  fixture.detectChanges();
  return fixture;
}

async function waitForWidget(fixture: ComponentFixture<HostComponent>): Promise<HTMLElement> {
  await waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("chat-iva")).not.toBeNull();
  });
  return fixture.nativeElement.querySelector("chat-iva") as HTMLElement;
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe("ChatIvaComponent", () => {
  it("registers a connector instance and activates it before the element exists", () => {
    const connector = makeFakeConnector("ng-test-connector-1");
    const fixture = createHost(connector);

    // Synchronous: the element is not rendered yet (the UI module loads lazily),
    // but `<chat-iva>` will read the store's active connector when it connects.
    expect(fixture.nativeElement.querySelector("chat-iva")).toBeNull();
    expect(ConnectorRegistry.has("ng-test-connector-1")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("ng-test-connector-1");
  });

  it("renders <chat-iva> once @chativa/ui has loaded, with projected content and the connector property", async () => {
    const connector = makeFakeConnector("ng-test-connector-2");
    const fixture = createHost(connector);

    const el = await waitForWidget(fixture);

    expect(el).toBeInstanceOf(customElements.get("chat-iva")!);
    expect((el as unknown as { connector: string }).connector).toBe("ng-test-connector-2");
    expect(el.querySelector(".projected")?.textContent).toBe("hi");
  });

  it("accepts a plain connector name without registering anything", () => {
    ConnectorRegistry.register(makeFakeConnector("ng-test-connector-3"));
    createHost("ng-test-connector-3");
    expect(chatStore.getState().activeConnector).toBe("ng-test-connector-3");
    ConnectorRegistry.unregister("ng-test-connector-3");
  });

  it("re-emits EventBus events as outputs and unsubscribes on destroy", () => {
    const fixture = createHost(makeFakeConnector("ng-test-connector-4"));
    const host = fixture.componentInstance;
    const message = { id: "m1", type: "text", data: { text: "hello" } } as IncomingMessage;

    EventBus.emit("message_received", message);
    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "error" });
    EventBus.emit("widget_opened", undefined);

    expect(host.onMessage).toHaveBeenCalledWith(message);
    expect(host.onConnect).toHaveBeenCalledTimes(1);
    expect(host.onDisconnect).toHaveBeenCalledWith({ status: "error" });
    expect(host.onWidgetOpen).toHaveBeenCalledTimes(1);

    fixture.destroy();
    EventBus.emit("message_received", message);
    expect(host.onMessage).toHaveBeenCalledTimes(1);
  });

  it("forwards the element's chativa-reset DOM event and removes the listener on destroy", async () => {
    const fixture = createHost(makeFakeConnector("ng-test-connector-5"));
    const host = fixture.componentInstance;
    const el = await waitForWidget(fixture);

    el.dispatchEvent(new CustomEvent("chativa-reset"));
    expect(host.onReset).toHaveBeenCalledTimes(1);

    fixture.destroy();
    el.dispatchEvent(new CustomEvent("chativa-reset"));
    expect(host.onReset).toHaveBeenCalledTimes(1);
  });

  it("round-trips a message through a real DummyConnector", async () => {
    const dummy = new DummyConnector({ name: "ng-test-dummy", replyDelay: 10, connectDelay: 0 });
    const fixture = createHost(dummy);
    const host = fixture.componentInstance;
    const el = await waitForWidget(fixture);

    chatStore.getState().open();
    await waitFor(() => expect(host.onConnect).toHaveBeenCalled());

    const input = await new Promise<Element>((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const found = el.shadowRoot?.querySelector("chat-input");
        if (found) resolve(found);
        else if (Date.now() - started > 5000) reject(new Error("chat-input not rendered"));
        else setTimeout(poll, 10);
      };
      poll();
    });
    input.dispatchEvent(
      new CustomEvent("send-message", { detail: "hello from angular", bubbles: true, composed: true }),
    );

    await waitFor(() => expect(host.onMessage).toHaveBeenCalled());
    expect(host.onMessage.mock.calls[0]![0].type).toBeTypeOf("string");

    chatStore.getState().close();
  });

  it("applies fullscreenOnly through the store, and treats false as no opinion", () => {
    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);

    const off = TestBed.createComponent(ChatIvaComponent);
    off.componentRef.instance.fullscreenOnly = false;
    expect(chatStore.getState().isFullscreen).toBe(false);
    expect(chatStore.getState().allowFullscreen).toBe(true);

    // Bare attribute form: `<chativa-chat-iva fullscreenOnly />` binds "".
    const on = TestBed.createComponent(ChatIvaComponent);
    on.componentRef.instance.fullscreenOnly = "";
    expect(on.componentRef.instance.fullscreenOnly).toBe(true);
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(chatStore.getState().allowFullscreen).toBe(false);

    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);
  });
});
