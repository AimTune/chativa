// @chativa/rn-webview — embeds the Chativa web widget in a WebView,
// bridged to native props/callbacks. See README.md for architecture.

export { ChativaWebView } from "./ChativaWebView";
export type { ChativaWebViewProps } from "./ChativaWebView";

export { buildBootstrapHtml } from "./bridge/bootstrapHtml";
export type { BuildBootstrapHtmlOptions } from "./bridge/bootstrapHtml";

export { sendToChativaWebView } from "./bridge/postMessage";

export type {
  BridgeInMessage,
  BridgeOutMessage,
  BuiltinConnectorType,
  ChativaConnectorSpec,
  ChativaWebViewSettings,
  GenUIComponentSummary,
  MekikAuthSpec,
  MekikConnectorSpecOptions,
} from "./bridge/types";

// Re-export core types so consumers don't need a separate `@chativa/core`
// import for basic typing — mirrors `@chativa/react`'s re-export surface.
export type {
  IConnector,
  IExtension,
  ThemeConfig,
  ThemeColors,
  LayoutConfig,
  AvatarConfig,
  DeepPartial,
  EndOfConversationSurveyConfig,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
} from "@chativa/core";
