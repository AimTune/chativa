import "./zone-testbed";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { Component, NgModule } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  ConnectorRegistry,
  EventBus,
  ExtensionRegistry,
  chatStore,
  type IExtension,
} from "@chativa/core";
import { ChativaService } from "../chativa.service";
import { provideChativa } from "../provide-chativa";
import { ChativaModule } from "../chativa.module";
import { makeFakeConnector } from "./helpers";

function makeExtension(name: string): IExtension & { install: ReturnType<typeof vi.fn> } {
  return { name, version: "1.0.0", install: vi.fn() };
}

beforeEach(() => {
  ConnectorRegistry.clear();
  ExtensionRegistry.clear();
});

afterEach(() => {
  TestBed.resetTestingModule();
  chatStore.getState().setConnector("dummy");
});

describe("ChativaService", () => {
  it("registers connectors idempotently and activates them", () => {
    const service = TestBed.inject(ChativaService);
    const connector = makeFakeConnector("svc-connector");

    service.registerConnector(connector);
    service.registerConnector(connector); // no "already registered" throw
    expect(service.listConnectors()).toEqual(["svc-connector"]);

    expect(service.useConnector("svc-connector")).toBe("svc-connector");
    expect(service.activeConnector).toBe("svc-connector");

    service.unregisterConnector("svc-connector");
    expect(ConnectorRegistry.has("svc-connector")).toBe(false);
  });

  it("useConnector auto-registers an instance", () => {
    const service = TestBed.inject(ChativaService);
    service.useConnector(makeFakeConnector("svc-auto"));
    expect(ConnectorRegistry.has("svc-auto")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("svc-auto");
  });

  it("installs extensions once and uninstalls them", () => {
    const service = TestBed.inject(ChativaService);
    const ext = makeExtension("svc-ext");

    service.installExtension(ext);
    service.installExtension(ext);
    expect(ext.install).toHaveBeenCalledTimes(1);
    expect(service.listExtensions()).toEqual(["svc-ext"]);

    service.uninstallExtension("svc-ext");
    expect(ExtensionRegistry.has("svc-ext")).toBe(false);
  });

  it("applies theme overrides and open/close to the shared chatStore", () => {
    const service = TestBed.inject(ChativaService);
    service.setTheme({ colors: { primary: "#123456" } });
    expect(chatStore.getState().theme.colors.primary).toBe("#123456");

    service.open();
    expect(chatStore.getState().isOpened).toBe(true);
    service.close();
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("toggle() flips the panel open state in the shared chatStore", () => {
    const service = TestBed.inject(ChativaService);
    chatStore.getState().close();

    service.toggle();
    expect(chatStore.getState().isOpened).toBe(true);
    service.toggle();
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("configure() with only a theme leaves connectors and extensions alone", () => {
    const service = TestBed.inject(ChativaService);
    const before = chatStore.getState().activeConnector;

    service.configure({ theme: { colors: { primary: "#654321" } } });

    expect(chatStore.getState().theme.colors.primary).toBe("#654321");
    expect(chatStore.getState().activeConnector).toBe(before);
    expect(service.listConnectors()).toEqual([]);
    expect(service.listExtensions()).toEqual([]);
  });

  it("useConnector skips the store write when the connector is already active", () => {
    const service = TestBed.inject(ChativaService);
    service.useConnector(makeFakeConnector("svc-already-active"));

    const listener = vi.fn();
    const unsubscribe = chatStore.subscribe(listener);
    expect(service.useConnector("svc-already-active")).toBe("svc-already-active");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("on() subscribes to EventBus and is cleaned up when the injector is destroyed", () => {
    const service = TestBed.inject(ChativaService);
    const a = vi.fn();
    const b = vi.fn();
    const offA = service.on("widget_opened", a);
    service.on("widget_closed", b);

    EventBus.emit("widget_opened", undefined);
    offA();
    EventBus.emit("widget_opened", undefined);
    expect(a).toHaveBeenCalledTimes(1);

    TestBed.resetTestingModule(); // destroys the root injector → ngOnDestroy
    EventBus.emit("widget_closed", undefined);
    expect(b).not.toHaveBeenCalled();
  });
});

describe("provideChativa / ChativaModule.forRoot", () => {
  @Component({ standalone: true, template: "" })
  class EmptyComponent {}

  it("provideChativa() applies the config when the environment injector is created", () => {
    const ext = makeExtension("provided-ext");
    TestBed.configureTestingModule({
      providers: [
        provideChativa({ connector: makeFakeConnector("provided"), extensions: [ext] }),
      ],
    });
    TestBed.createComponent(EmptyComponent);

    expect(ConnectorRegistry.has("provided")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("provided");
    expect(ext.install).toHaveBeenCalledTimes(1);
  });

  it("ChativaModule.forRoot() does the same for NgModule apps and exports the components", () => {
    @Component({
      template: `<chativa-chat-iva /><chativa-chat-bot-button /><chativa-genui-message />`,
    })
    class ModuleHostComponent {}

    @NgModule({
      declarations: [ModuleHostComponent],
      imports: [ChativaModule.forRoot({ connector: makeFakeConnector("from-module") })],
    })
    class AppModule {}

    TestBed.configureTestingModule({ imports: [AppModule] });
    const fixture = TestBed.createComponent(ModuleHostComponent);
    fixture.detectChanges();

    expect(chatStore.getState().activeConnector).toBe("from-module");
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector("chativa-chat-iva")).not.toBeNull();
    expect(root.querySelector("chativa-chat-bot-button")).not.toBeNull();
    expect(root.querySelector("chativa-genui-message")).not.toBeNull();
  });
});
