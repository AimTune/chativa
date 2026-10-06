// @chativa/angular — Angular wrapper components for the Chativa chat widget

export { ChatIvaComponent } from "./chat-iva.component";
export type { ChatIvaDisconnectEvent } from "./chat-iva.component";

export { ChatBotButtonComponent } from "./chat-bot-button.component";

export { GenUIMessageComponent } from "./genui-message.component";
export type { GenUISendEventDetail } from "./genui-message.component";

export { ChativaService } from "./chativa.service";
export type { ChativaConfig } from "./chativa.service";

export { provideChativa, CHATIVA_CONFIG } from "./provide-chativa";
export { ChativaModule } from "./chativa.module";

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
  GenUIEventOptions,
} from "@chativa/core";
