// @chativa/vue2 — Vue 2.7 wrapper components + plugin for the Chativa chat widget

import { Chativa } from "./plugin";

export { Chativa };
export default Chativa;
export type { ChativaPluginOptions } from "./plugin";

export { ChatIva } from "./ChatIva";
export { ChatBotButton } from "./ChatBotButton";
export { GenUIMessage } from "./GenUIMessage";

export { useChativaEvent } from "./composables/useChativaEvent";

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
