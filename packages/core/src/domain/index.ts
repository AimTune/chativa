// Domain — pure types and interfaces
export type { IncomingMessage, OutgoingMessage, MessageSender } from "./entities/Message";
export { createOutgoingMessage } from "./entities/Message";
export type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
} from "./ports/IConnector";
export type { IExtension, ExtensionContext, MessageTransformer } from "./ports/IExtension";
export type { IMessageRenderer } from "./ports/IMessageRenderer";
export type {
  ThemeConfig,
  ThemeColors,
  LayoutConfig,
  ButtonPosition,
  ButtonSize,
  SpaceLevel,
  DeepPartial,
} from "./value-objects/Theme";
export { DEFAULT_THEME, mergeTheme, themeToCSS } from "./value-objects/Theme";
