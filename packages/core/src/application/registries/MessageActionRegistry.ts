import {
  messageActionMatches,
  type IMessageAction,
  type MessageActionContext,
} from "../../domain/ports/IMessageAction";

const _actions = new Map<string, IMessageAction>();

/**
 * Registry for custom per-message actions.
 * The message action bar (`<message-actions>` in @chativa/ui) renders every
 * registered action that applies to a message after the built-in copy /
 * regenerate / edit buttons.
 */
export const MessageActionRegistry = {
  register(action: IMessageAction): void {
    _actions.set(action.name, action);
  },

  unregister(name: string): void {
    _actions.delete(name);
  },

  get(name: string): IMessageAction | undefined {
    return _actions.get(name);
  },

  has(name: string): boolean {
    return _actions.has(name);
  },

  /** Every registered action, sorted by `order` (registration order breaks ties). */
  list(): IMessageAction[] {
    return Array.from(_actions.values()).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
  },

  /**
   * The actions to show on one message: matching the sender and message-type
   * filters, then passing `isVisible`.
   */
  forMessage(context: MessageActionContext): IMessageAction[] {
    return MessageActionRegistry.list().filter((action) => {
      if (!messageActionMatches(action, context.sender, context.message.type)) return false;
      return action.isVisible ? action.isVisible(context) : true;
    });
  },

  /** Reset all actions — for use in tests only. */
  clear(): void {
    _actions.clear();
  },
};
