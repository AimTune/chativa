// Domain — pure types and interfaces
export type { IncomingMessage, OutgoingMessage, MessageSender, MessageAction, MessageStatus, HistoryResult } from "./entities/Message";
export { createOutgoingMessage } from "./entities/Message";
export type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
  FeedbackType,
  MessageStatusHandler,
} from "./ports/IConnector";
export type { IExtension, ExtensionContext, MessageTransformer } from "./ports/IExtension";
export type { ISlashCommand, CommandContext } from "./ports/ISlashCommand";
export { resolveText } from "./ports/ISlashCommand";
export type { IMessageRenderer } from "./ports/IMessageRenderer";
export type {
  ThemeConfig,
  ThemeColors,
  LayoutConfig,
  ButtonPosition,
  ButtonSize,
  SpaceLevel,
  DeepPartial,
  AvatarConfig,
} from "./value-objects/Theme";
export { DEFAULT_THEME, mergeTheme, themeToCSS } from "./value-objects/Theme";
