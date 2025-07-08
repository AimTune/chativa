import { DefaultTextMessage } from "../chat-ui/DefaultTextMessage";

const registry = new Map<string, typeof HTMLElement>();

export const useMessageTypeRegistry = {
  register(type: string, component: typeof HTMLElement) {
    registry.set(type, component);
  },
  resolve(type: string) {
    return registry.get(type) ?? DefaultTextMessage;
  },
};
