import type {
  ConnectorStatus,
  DeepPartial,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
  ThemeConfig,
  ToolCall,
} from "@chativa/core";

/**
 * Built-in connector types the bootstrap page knows how to load from a CDN
 * script by name. Anything else (e.g. a private connector) goes through
 * `type: "custom"`.
 */
export type BuiltinConnectorType =
  | "dummy"
  | "websocket"
  | "signalr"
  | "directline"
  | "http"
  | "sse"
  | "mekik";

/**
 * JSON-safe mirror of `@chativa/connector-mekik`'s auth adapters, reconstructed
 * as a real `TokenAuth` / `CookieAuth` instance inside the WebView. Function
 * credentials (a token-minting callback, `CookieAuth`'s `refresh`) can't cross
 * the native/web bridge and are deliberately unsupported here — apps needing
 * them should host the widget with `@chativa/react` or supply a `custom`
 * connector script that builds its own provider.
 */
export type MekikAuthSpec =
  | {
      kind: "token";
      token: string;
      transport?: "hello" | "query";
      queryParam?: string;
      maxRetries?: number;
    }
  | { kind: "cookie" };

/**
 * JSON-safe subset of `MekikConnectorOptions` from `@chativa/connector-mekik`.
 * Defined locally (not type-imported) so the published `.d.ts` gains no new
 * dependency; a type-compatibility test guards against drift.
 */
export interface MekikConnectorSpecOptions {
  /** mekik WebSocket endpoint, e.g. "ws://192.168.1.10:8790/chat". */
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  reconnectBackoff?: "fixed" | "exponential";
  reconnectMaxDelay?: number;
  routeInUrl?: boolean;
  queueOfflineMessages?: boolean;
  userId?: string;
  conversationId?: string;
  resumeConversation?: boolean;
  auth?: MekikAuthSpec;
  /**
   * Plain-string shorthand only — the connector's function form can't cross
   * the bridge; prefer `auth: { kind: "token", ... }`.
   */
  token?: string;
  // `tools` / `allowDynamicTools` (client tools, mekik PROTOCOL.md §11) are
  // deliberately absent: each tool carries a handler function, which can't
  // cross the native/web bridge. Apps needing client tools should host the
  // widget with `@chativa/react` or supply a `custom` connector script that
  // constructs its own MekikConnector with tools.
}

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
      type: Exclude<BuiltinConnectorType, "mekik">;
      options?: Record<string, unknown>;
    }
  | {
      type: "mekik";
      options: MekikConnectorSpecOptions;
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

/**
 * Summary of a server-defined GenUI component the widget registered — name and
 * version only. The full definition (template/css/props) stays inside the
 * WebView where it's rendered; bridging it out is the native-renderer
 * (Phase 2) concern.
 */
export interface GenUIComponentSummary {
  name: string;
  version?: string;
  tag?: string;
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
  | { type: "genui_components_registered"; payload: { components: GenUIComponentSummary[] } }
  | { type: "genui_stream_started"; payload: { streamId: string } }
  | { type: "genui_stream_completed"; payload: { streamId: string } }
  | { type: "tool_call_updated"; payload: ToolCall }
  | { type: "auth_error"; payload: { code: string; message: string } }
  | { type: "error"; payload: { message: string } };

// ── Inbound: React Native -> WebView ───────────────────────────────────────

export type BridgeInMessage =
  | { type: "set_theme"; payload: DeepPartial<ThemeConfig> }
  | { type: "send_message"; payload: { text: string; markdown?: boolean } }
  | { type: "open_widget" }
  | { type: "close_widget" };
