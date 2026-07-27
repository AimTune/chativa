import type {
  ConnectorStatus,
  DeepPartial,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
  ThemeConfig,
} from "@chativa/core";

/**
 * Built-in connector types the bootstrap page knows how to load from a CDN
 * script by name. Anything else (e.g. `@chativa/connector-mekik`, or a
 * private connector) goes through `type: "custom"`.
 */
export type BuiltinConnectorType =
  | "dummy"
  | "websocket"
  | "signalr"
  | "directline"
  | "http"
  | "sse";

/**
 * Describes which connector to construct *inside the WebView*. A live
 * `IConnector` instance can't cross the native/web bridge (it may hold
 * closures, sockets, timers), so instead we describe how to build one from
 * a CDN-loaded global — mirrors how a plain HTML page would do
 * `new window.ChativaWebSocket.WebSocketConnector(options)`.
 *
 * `options` must be JSON-serializable — it's inlined into the bootstrap
 * page as `window.chativaSettings`-style config, not passed as a live
 * object.
 */
export type ChativaConnectorSpec =
  | {
      type: BuiltinConnectorType;
      options?: Record<string, unknown>;
    }
  | {
      type: "custom";
      /** Script URL for the connector's CDN/global (IIFE) build. */
      scriptUrl: string;
      /** The `window.<globalName>` the script assigns itself to. */
      globalName: string;
      /** The exported class name to instantiate from that global, e.g. `"MekikConnector"`. */
      className: string;
      options?: Record<string, unknown>;
    };

/** Config the RN side sends into the WebView on load. Mirrors `ChativaSettings` from `@chativa/core`. */
export interface ChativaWebViewSettings {
  connector: ChativaConnectorSpec;
  theme?: DeepPartial<ThemeConfig>;
  locale?: string;
  i18n?: Record<string, unknown>;
}

// ── Outbound: WebView (web widget) -> React Native ────────────────────────

export type BridgeOutMessage =
  | { type: "ready" }
  | { type: "message_received"; payload: IncomingMessage }
  | { type: "message_sent"; payload: OutgoingMessage }
  | { type: "connector_status_changed"; payload: { status: ConnectorStatus } }
  | { type: "survey_submitted"; payload: SurveyPayload }
  | { type: "widget_opened" }
  | { type: "widget_closed" }
  | { type: "error"; payload: { message: string } };

// ── Inbound: React Native -> WebView ───────────────────────────────────────

export type BridgeInMessage = { type: "set_theme"; payload: DeepPartial<ThemeConfig> };
