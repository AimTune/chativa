/**
 * IExtension — Port definition for Chativa extensions.
 *
 * Extensions can hook into the message pipeline, widget lifecycle,
 * and register custom message types or UI components.
 *
 * No external dependencies allowed in this file.
 */

import type { IncomingMessage, OutgoingMessage } from "../entities/Message";

export type MessageTransformer<T extends IncomingMessage | OutgoingMessage> =
  (message: T) => T | null;

export interface ExtensionContext {
  /** Hook called before a message is sent. Return null to cancel. */
  onBeforeSend(handler: MessageTransformer<OutgoingMessage>): void;
  /** Hook called after a message is received. Return null to drop. */
  onAfterReceive(handler: MessageTransformer<IncomingMessage>): void;
  /** Hook called when the chat widget opens. */
  onWidgetOpen(handler: () => void): void;
  /** Hook called when the chat widget closes. */
  onWidgetClose(handler: () => void): void;
}

export interface IExtension {
  /** Unique extension name. */
  readonly name: string;

  /** Semantic version string. */
  readonly version: string;

  /** Called once when the extension is installed. */
  install(context: ExtensionContext): void;

  /** Called when the extension is uninstalled. */
  uninstall?(): void;
}
