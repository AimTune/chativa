// @chativa/react — React wrapper components for the Chativa chat widget

export { ChativaProvider } from "./ChativaProvider";
export type { ChativaProviderProps } from "./ChativaProvider";

export { ChatIva } from "./ChatIva";
export type { ChatIvaProps } from "./ChatIva";

export { ChatBotButton } from "./ChatBotButton";
export type { ChatBotButtonProps } from "./ChatBotButton";

export { GenUIMessage } from "./GenUIMessage";
export type { GenUIMessageProps } from "./GenUIMessage";

export { useChativaEvent } from "./hooks/useChativaEvent";

// ── Re-exported `@chativa/core` types for consumer apps ──────────────────────
// (`@chativa/core` is a required peer dependency, so this adds no extra install.)
export type {
  IConnector,
  IExtension,
  ExtensionContext,
  MessageTransformer,
  ThemeConfig,
  ThemeColors,
  LayoutConfig,
  AvatarConfig,
  ButtonPosition,
  ButtonSize,
  SpaceLevel,
  WindowMode,
  DeepPartial,
  EndOfConversationSurveyConfig,
  IncomingMessage,
  OutgoingMessage,
  MessageSender,
  MessageStatus,
  SurveyPayload,
  ConnectorStatus,
  EventBusEventName,
  EventBusPayloadMap,
} from "@chativa/core";
