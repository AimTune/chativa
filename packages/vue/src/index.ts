// @chativa/vue — Vue 3 wrapper components, plugin and composables for the Chativa chat widget

export { ChativaPlugin, applyChativaOptions } from "./plugin";
export type { ChativaPluginOptions } from "./plugin";

export { ChatIva } from "./ChatIva";
export type { ChatIvaProps } from "./ChatIva";

export { ChatBotButton } from "./ChatBotButton";

export { GenUIMessage } from "./GenUIMessage";
export type { GenUIMessageProps, GenUISendEventDetail } from "./GenUIMessage";

export { useChativaEvent } from "./composables/useChativaEvent";
export { useChat } from "./composables/useChat";
export type { UseChatReturn } from "./composables/useChat";
export { useMessages } from "./composables/useMessages";
export type { UseMessagesReturn } from "./composables/useMessages";
export { useGenUIStream } from "./composables/useGenUIStream";
export type { GenUIStream, UseGenUIStreamReturn } from "./composables/useGenUIStream";

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
  StoredMessage,
  MessageSender,
  MessageStatus,
  SurveyPayload,
  ConnectorStatus,
  ChatStoreState,
  EventBusEventName,
  EventBusPayloadMap,
  AIChunk,
  GenUIStreamState,
  GenUIEventOptions,
  ToolCall,
} from "@chativa/core";

// ── Global component types for `app.use(ChativaPlugin)` users ────────────────
// Lets Volar / vue-tsc type-check `<ChatIva>` in templates without a local
// import once the plugin has registered it globally.
import type { ChatIva } from "./ChatIva";
import type { ChatBotButton } from "./ChatBotButton";
import type { GenUIMessage } from "./GenUIMessage";

declare module "vue" {
  export interface GlobalComponents {
    ChatIva: typeof ChatIva;
    ChatBotButton: typeof ChatBotButton;
    GenUIMessage: typeof GenUIMessage;
  }
}
