import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  ConnectorRegistry,
  ExtensionRegistry,
  chatStore,
  type IConnector,
  type IExtension,
} from "@chativa/core";
import { ChativaProvider } from "../ChativaProvider";

afterEach(() => {
  cleanup();
});

function makeFakeConnector(name: string): IConnector {
  return {
    name,
    async connect() {},
    async disconnect() {},
    async sendMessage() {},
    onMessage() {},
  };
}

describe("ChativaProvider", () => {
  it("renders its children synchronously", () => {
    const { getByText } = render(
      <ChativaProvider>
        <div>hello</div>
      </ChativaProvider>,
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("auto-registers an IConnector instance and activates it in chatStore", () => {
    const connector = makeFakeConnector("provider-test-connector");

    render(
      <ChativaProvider connector={connector}>
        <div />
      </ChativaProvider>,
    );

    expect(ConnectorRegistry.has("provider-test-connector")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("provider-test-connector");

    ConnectorRegistry.unregister("provider-test-connector");
  });

  it("does not re-register an already-registered connector name", () => {
    const connector = makeFakeConnector("provider-test-connector-2");
    ConnectorRegistry.register(connector);

    expect(() =>
      render(
        <ChativaProvider connector={connector}>
          <div />
        </ChativaProvider>,
      ),
    ).not.toThrow();

    ConnectorRegistry.unregister("provider-test-connector-2");
  });

  it("installs extensions once", () => {
    let installCount = 0;
    const extension: IExtension = {
      name: "provider-test-extension",
      version: "1.0.0",
      install() {
        installCount++;
      },
    };

    render(
      <ChativaProvider extensions={[extension]}>
        <div />
      </ChativaProvider>,
    );

    expect(installCount).toBe(1);
    expect(ExtensionRegistry.has("provider-test-extension")).toBe(true);

    ExtensionRegistry.uninstall("provider-test-extension");
  });

  it("applies theme overrides", () => {
    render(
      <ChativaProvider theme={{ colors: { primary: "#123456" } }}>
        <div />
      </ChativaProvider>,
    );

    expect(chatStore.getState().theme.colors.primary).toBe("#123456");
  });
});
