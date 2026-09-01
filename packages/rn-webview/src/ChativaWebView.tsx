import * as React from "react";
import RNWebView, { type WebViewMessageEvent, type WebViewProps } from "react-native-webview";
import type { StyleProp, ViewStyle } from "react-native";
import type {
  ConnectorStatus,
  DeepPartial,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
  ThemeConfig,
  ToolCall,
} from "@chativa/core";
import { buildBootstrapHtml, type BuildBootstrapHtmlOptions } from "./bridge/bootstrapHtml";
import type { BridgeOutMessage, ChativaConnectorSpec, GenUIComponentSummary } from "./bridge/types";

// `react-native-webview`'s default export is `class WebView<P = undefined>
// extends Component<WebViewProps & P>` — used bare (no type argument),
// `P` defaults to `undefined` and `WebViewProps & undefined` collapses to
// `never`, rejecting every prop. Re-typing as a plain component sidesteps
// that generic-default quirk.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & React.RefAttributes<RNWebView>>;

export interface ChativaWebViewProps {
  /** Describes which connector to construct inside the WebView — see `ChativaConnectorSpec`. */
  connector: ChativaConnectorSpec;
  theme?: DeepPartial<ThemeConfig>;
  locale?: string;
  i18n?: Record<string, unknown>;
  /** Base URL scripts are resolved against. Default: jsdelivr's `@latest` tag for each package. */
  cdnBaseUrl?: string;
  /** Pin exact versions per package instead of `@latest`. */
  versions?: BuildBootstrapHtmlOptions["versions"];
  style?: StyleProp<ViewStyle>;

  /** The bootstrap page finished loading and the bridge is wired up. */
  onReady?: () => void;
  /** A bot/connector message was delivered. */
  onMessage?: (message: IncomingMessage) => void;
  /** The user sent a message. */
  onMessageSent?: (message: OutgoingMessage) => void;
  /** The connector transitioned to `"connected"`. */
  onConnect?: () => void;
  /** The connector transitioned to `"disconnected"` or `"error"`. */
  onDisconnect?: (payload: { status: ConnectorStatus }) => void;
  /** The end-of-conversation survey was submitted. */
  onSurveySubmit?: (payload: SurveyPayload) => void;
  /** The chat panel opened. Fires once immediately — the embedded widget has no launcher and opens on load. */
  onWidgetOpen?: () => void;
  onWidgetClose?: () => void;
  /**
   * The server announced GenUI component definitions and the widget registered
   * them as custom elements. Summaries only (name/version/tag) — the full
   * template renders inside the WebView.
   */
  onGenUIComponentsRegistered?: (payload: { components: GenUIComponentSummary[] }) => void;
  /** A GenUI stream started (first chunk received). */
  onGenUIStreamStarted?: (payload: { streamId: string }) => void;
  /** A GenUI stream completed. */
  onGenUIStreamCompleted?: (payload: { streamId: string }) => void;
  /** A connector tool call started or changed state (upsert by `id`). */
  onToolCallUpdated?: (toolCall: ToolCall) => void;
  /** The server rejected the connection (mekik connector's `onAuthError`). */
  onAuthError?: (payload: { code: string; message: string }) => void;
  /** An error was thrown while wiring up the bridge inside the WebView. */
  onError?: (message: string) => void;
}

/**
 * Embeds the existing Chativa web widget (`@chativa/ui` + `@chativa/genui`,
 * loaded from each package's published CDN/global build) inside a
 * `react-native-webview`, configured via the same connector/theme/locale
 * shape `@chativa/core`'s `ChativaSettings` already uses on the web.
 *
 * This is `@chativa/rn-webview`'s rendering strategy
 * (see the package README) — a from-scratch native RN UI is tracked
 * separately per platform (issues #29 iOS, #30 Android) as a conditional
 * follow-up, only if this doesn't meet the UX bar in practice.
 *
 * Because the widget itself runs inside the WebView's real browser engine,
 * *all* existing `@chativa/connector-*` packages work completely unmodified
 * — there is no connector code to port.
 */
export const ChativaWebView = React.forwardRef<RNWebView, ChativaWebViewProps>(function ChativaWebView(
  {
    connector,
    theme,
    locale,
    i18n,
    cdnBaseUrl,
    versions,
    style,
    onReady,
    onMessage,
    onMessageSent,
    onConnect,
    onDisconnect,
    onSurveySubmit,
    onWidgetOpen,
    onWidgetClose,
    onGenUIComponentsRegistered,
    onGenUIStreamStarted,
    onGenUIStreamCompleted,
    onToolCallUpdated,
    onAuthError,
    onError,
  },
  ref,
) {
  // Built once per mount, not on every prop change: changing it would force
  // a full WebView reload (new page load, connector reconnects from
  // scratch). For a live theme update after mount, use
  // `sendToChativaWebView(ref, { type: "set_theme", payload })` instead.
  const html = React.useMemo(
    () => buildBootstrapHtml({ settings: { connector, theme, locale, i18n }, cdnBaseUrl, versions }),
    [],
  );

  const handleMessage = React.useCallback(
    (event: WebViewMessageEvent) => {
      let data: BridgeOutMessage;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      switch (data.type) {
        case "ready":
          onReady?.();
          break;
        case "message_received":
          onMessage?.(data.payload);
          break;
        case "message_sent":
          onMessageSent?.(data.payload);
          break;
        case "connector_status_changed":
          if (data.payload.status === "connected") onConnect?.();
          else if (data.payload.status === "disconnected" || data.payload.status === "error")
            onDisconnect?.(data.payload);
          break;
        case "survey_submitted":
          onSurveySubmit?.(data.payload);
          break;
        case "widget_opened":
          onWidgetOpen?.();
          break;
        case "widget_closed":
          onWidgetClose?.();
          break;
        case "genui_components_registered":
          onGenUIComponentsRegistered?.(data.payload);
          break;
        case "genui_stream_started":
          onGenUIStreamStarted?.(data.payload);
          break;
        case "genui_stream_completed":
          onGenUIStreamCompleted?.(data.payload);
          break;
        case "tool_call_updated":
          onToolCallUpdated?.(data.payload);
          break;
        case "auth_error":
          onAuthError?.(data.payload);
          break;
        case "error":
          onError?.(data.payload.message);
          break;
      }
    },
    [
      onReady,
      onMessage,
      onMessageSent,
      onConnect,
      onDisconnect,
      onSurveySubmit,
      onWidgetOpen,
      onWidgetClose,
      onGenUIComponentsRegistered,
      onGenUIStreamStarted,
      onGenUIStreamCompleted,
      onToolCallUpdated,
      onAuthError,
      onError,
    ],
  );

  return (
    <WebView
      ref={ref}
      source={{ html }}
      onMessage={handleMessage}
      style={style}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      // The bootstrap page loads its scripts from a CDN — needed unless the
      // consumer overrides `cdnBaseUrl` to point at bundled local assets.
      mixedContentMode="always"
    />
  );
});
