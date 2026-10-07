import { MessageActionRegistry, messageStore, type MessageActionContext } from "@chativa/core";

/**
 * Sandbox demo of custom message actions (MessageActionRegistry) — the three
 * examples from the docs: Share, Report and Translate. They render in the
 * "⋮" menu after the built-in copy / regenerate / edit buttons, with labels
 * in English, Turkish, German, French and Spanish (`translations`).
 */

const textOf = ({ message }: MessageActionContext): string =>
  typeof message.data?.text === "string" ? message.data.text : "";

export function registerSandboxMessageActions(): void {
  // Share — Web Share API where available, otherwise copy the text.
  // Text messages only (`messageTypes`).
  MessageActionRegistry.register({
    name: "share",
    label: "Share",
    translations: { tr: "Paylaş", de: "Teilen", fr: "Partager", es: "Compartir" },
    icon: "📤",
    order: 10,
    messageTypes: ["text"],
    isVisible: (ctx) => textOf(ctx) !== "",
    async execute(ctx) {
      const text = textOf(ctx);
      if (navigator.share) {
        await navigator.share({ text }).catch(() => { /* user cancelled */ });
      } else {
        await navigator.clipboard?.writeText(text);
        console.info("[sandbox] Share: no Web Share API — copied to the clipboard instead.");
      }
    },
  });

  // Report — every bot message type except GenUI widgets (`excludeMessageTypes`);
  // marks the message as reported, which hides the button again (shows how
  // `isVisible` reacts to message data).
  MessageActionRegistry.register({
    name: "report",
    label: "Report this answer",
    translations: { tr: "Bu yanıtı bildir", de: "Antwort melden", fr: "Signaler cette réponse", es: "Reportar esta respuesta" },
    icon: "🚩",
    order: 20,
    excludeMessageTypes: ["genui"],
    isVisible: ({ message }) => message.data?.reported !== true,
    execute({ message }) {
      console.info("[sandbox] Reported message", message.id, message.data);
      messageStore.getState().updateById(message.id, {
        data: { ...message.data, reported: true },
      });
    },
  });

  // Translate — bot and user messages (`appliesTo` as a list), only types that
  // carry prose; opens Google Translate for the text.
  MessageActionRegistry.register({
    name: "translate",
    label: "Translate",
    translations: { tr: "Çevir", de: "Übersetzen", fr: "Traduire", es: "Traducir" },
    icon: "🌐",
    appliesTo: ["bot", "user"],
    messageTypes: ["text", "buttons", "quick-reply"],
    order: 30,
    isVisible: (ctx) => textOf(ctx) !== "",
    execute(ctx) {
      const url = `https://translate.google.com/?sl=auto&tl=en&op=translate&text=${encodeURIComponent(textOf(ctx))}`;
      window.open(url, "_blank", "noopener");
    },
  });
}
