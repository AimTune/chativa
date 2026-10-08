// @chativa/svelte — Svelte 5 wrapper components, stores and helpers for the Chativa chat widget

export { default as ChativaProvider } from "./ChativaProvider.svelte";
export { default as ChatIva } from "./ChatIva.svelte";
export { default as ChatBotButton } from "./ChatBotButton.svelte";
export { default as GenUIMessage } from "./GenUIMessage.svelte";
export type {
  ChativaProviderProps,
  ChatIvaProps,
  ChatBotButtonProps,
  GenUIMessageProps,
} from "./types.js";

export { chatState, messageState, messages, toReadable } from "./stores.js";
export type { ZustandLikeStore } from "./stores.js";

export { registerChativa } from "./registerChativa.js";
export { onChativaEvent } from "./events.js";

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
  ChatStoreState,
  MessageStoreState,
  StoredMessage,
} from "@chativa/core";
