export interface BaseMessage {
  id: string;
  type: string;
  data: {
    text: string;
  };
}

export interface ChatAdapter {
  sendMessage(message: BaseMessage): void;
  onMessage(callback: (msg: BaseMessage) => void): void;
}

const adapterRegistry = new Map<string, ChatAdapter>();

export const useAdapterRegistry = {
  register(name: string, adapter: ChatAdapter) {
    adapterRegistry.set(name, adapter);
  },
  get(name: string) {
    return adapterRegistry.get(name);
  },
};
