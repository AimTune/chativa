import type { IExtension, ExtensionContext, MessageTransformer } from "../../domain/ports/IExtension";
import type { IncomingMessage, OutgoingMessage } from "../../domain/entities/Message";
import { SlashCommandRegistry } from "./SlashCommandRegistry";

/** Internal pipeline storage. */
interface Pipeline {
  beforeSend: MessageTransformer<OutgoingMessage>[];
  afterReceive: MessageTransformer<IncomingMessage>[];
  onOpen: (() => void)[];
  onClose: (() => void)[];
}

const extensions = new Map<string, IExtension>();

const pipeline: Pipeline = {
  beforeSend: [],
  afterReceive: [],
  onOpen: [],
  onClose: [],
};

/** Build an ExtensionContext scoped to a single extension. */
function createContext(): ExtensionContext {
  return {
    onBeforeSend(handler) {
      pipeline.beforeSend.push(handler);
    },
    onAfterReceive(handler) {
      pipeline.afterReceive.push(handler);
    },
    onWidgetOpen(handler) {
      pipeline.onOpen.push(handler);
    },
    onWidgetClose(handler) {
      pipeline.onClose.push(handler);
    },
    registerCommand(command) {
      SlashCommandRegistry.register(command);
    },
  };
}

export const ExtensionRegistry = {
  install(extension: IExtension): void {
    if (extensions.has(extension.name)) {
      throw new Error(
        `ExtensionRegistry: extension "${extension.name}" is already installed.`
      );
    }
    extensions.set(extension.name, extension);
    extension.install(createContext());
  },

  uninstall(name: string): void {
    const ext = extensions.get(name);
    if (!ext) return;
    ext.uninstall?.();
    extensions.delete(name);
  },

  /** Run the outgoing message through all beforeSend transformers. Returns null if blocked. */
  runBeforeSend(message: OutgoingMessage): OutgoingMessage | null {
    let msg: OutgoingMessage | null = message;
    for (const handler of pipeline.beforeSend) {
      if (msg === null) return null;
      msg = handler(msg);
    }
    return msg;
  },

  /** Run the incoming message through all afterReceive transformers. Returns null if blocked. */
  runAfterReceive(message: IncomingMessage): IncomingMessage | null {
    let msg: IncomingMessage | null = message;
    for (const handler of pipeline.afterReceive) {
      if (msg === null) return null;
      msg = handler(msg);
    }
    return msg;
  },

  notifyOpen(): void {
    pipeline.onOpen.forEach((h) => h());
  },

  notifyClose(): void {
    pipeline.onClose.forEach((h) => h());
  },

  has(name: string): boolean {
    return extensions.has(name);
  },

  list(): string[] {
    return [...extensions.keys()];
  },

  /** For testing only. */
  clear(): void {
    extensions.clear();
    pipeline.beforeSend = [];
    pipeline.afterReceive = [];
    pipeline.onOpen = [];
    pipeline.onClose = [];
  },
};
