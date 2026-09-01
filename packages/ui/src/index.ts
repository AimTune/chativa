// @chativa/ui — LitElement web components
// Named exports
export { ChatbotMixin } from "./mixins/ChatbotMixin";
export { ChatWidget } from "./chat-ui/ChatWidget";
export { AgentPanel } from "./chat-ui/AgentPanel";
export { ConversationList } from "./chat-ui/ConversationList";
export { default as ChatBotButton } from "./chat-ui/ChatBotButton";
export { default as i18n } from "./i18n/i18n";
export { registerCommand } from "./commands/index";
export type { LocalizedCommandConfig, CommandTranslations } from "./commands/index";
export { render } from "./render";
export type { RenderOptions } from "./render";
export { GenUIRegistry } from "@chativa/genui";
// Server-defined GenUI components (mekik PROTOCOL §10). Re-exported here so a
// host that only depends on @chativa/ui can inspect or extend the registration
// this bundle already performs — adding `@chativa/genui` alongside it just to
// reach these would load a second copy of the same custom elements.
export {
  registerServerComponent,
  subscribeServerComponents,
  clearServerComponents,
  setServerComponentPolicy,
  getServerComponentPolicy,
} from "@chativa/genui";
export type { ServerComponentPolicy, GenUIComponentDefinition } from "@chativa/genui";
// Singletons the rn-webview bootstrap bridges against — the CDN (IIFE) build
// bundles core, so these are the same instances <chat-iva> itself uses.
export { EventBus, chatStore } from "@chativa/core";
// The i18n docs have always told readers to `import { i18next } from
// "@chativa/ui"` — this is the export that makes that true. It is core's
// instance, the same one `./i18n/i18n` initialises and every component reads.
export { i18next, t } from "@chativa/core";

// Side-effect registrations (registers custom elements)
// @chativa/genui: registers genui-message custom element + MessageTypeRegistry.register("genui", ...)
import "@chativa/genui";
import "./chat-ui/ChatWidget";
import "./chat-ui/ChatBotButton";
import "./chat-ui/ChatHeader";
import "./chat-ui/ChatInput";
import "./chat-ui/ChatMessageList";
import "./chat-ui/DefaultTextMessage";
import "./chat-ui/ImageMessage";
import "./chat-ui/CardMessage";
import "./chat-ui/ButtonsMessage";
import "./chat-ui/FileMessage";
import "./chat-ui/VideoMessage";
import "./chat-ui/CarouselMessage";
import "./chat-ui/QuickReplyMessage";
import "./chat-ui/EmojiPicker";
import "./chat-ui/ConversationList";
import "./chat-ui/AgentPanel";
import "./chat-ui/EndOfConversationSurvey";
import "./chat-ui/LinkPreviewCard";
import "./chat-ui/ToolCallCard";
import "./chat-ui/ToolCallActivity";

import { MessageTypeRegistry } from "@chativa/core";
import { EndOfConversationSurvey } from "./chat-ui/EndOfConversationSurvey";
export { EndOfConversationSurvey } from "./chat-ui/EndOfConversationSurvey";
export { LinkPreviewCard } from "./chat-ui/LinkPreviewCard";
export type { LinkMetadata, LinkMetadataFetcher } from "./chat-ui/LinkPreviewCard";
export { ToolCallCard } from "./chat-ui/ToolCallCard";
export { ToolCallActivity } from "./chat-ui/ToolCallActivity";
MessageTypeRegistry.register(
  "end-of-conversation-survey",
  EndOfConversationSurvey as unknown as typeof HTMLElement,
);
