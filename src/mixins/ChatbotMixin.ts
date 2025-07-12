import { LitElement } from "lit";


type Constructor<T = {}> = new (...args: any[]) => T;

// Define the interface for the mixin
export declare class ChatbotMixinInterface {
  unsubscribeChatBot: () => void;
}

export const ChatbotMixin = <T extends Constructor<LitElement>>(
  superClass: T
) => {
  class ChatbotMixin extends superClass {
    private unsubscribeChatBot!: () => void;

  }

  // Cast return type to your mixin's interface intersected with the superClass type
  return ChatbotMixin as unknown as Constructor<ChatbotMixinInterface> & T;
};
