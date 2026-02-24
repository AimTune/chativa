// @chativa/ui — LitElement web components
// Named exports
export { ChatbotMixin } from "./mixins/ChatbotMixin";
export { ChatWidget } from "./chat-ui/ChatWidget";
export { default as ChatBotButton } from "./chat-ui/ChatBotButton";
export { default as i18n } from "./i18n/i18n";
export { registerCommand } from "./commands/index";
export type { LocalizedCommandConfig, CommandTranslations } from "./commands/index";

// Side-effect registrations (registers custom elements)
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
