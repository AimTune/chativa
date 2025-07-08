import { createStore } from "zustand/vanilla";
import { set, pullAt } from "lodash-es";

export interface IChatMessage {
  id: string;
  type: string;
  data: any;
  component?: typeof HTMLElement;
}

export interface IMessageStore {
  messages: IChatMessage[];
  addMessage: (msg: IChatMessage) => void;
  removeMessage: (index: number) => void;
  clearMessages: () => void;
  updateMessage: (index: number, data: Partial<IChatMessage>) => void;
}

const store = createStore<IMessageStore>((setState) => ({
  messages: [],
  addMessage: (msg) =>
    setState((state) => ({ messages: [...state.messages, msg] })),
  removeMessage: (index) =>
    setState((state) => {
      pullAt(state.messages, index);
      return { messages: state.messages };
    }),
  clearMessages: () => setState(() => ({ messages: [] })),
  updateMessage: (index, data) =>
    setState((state) => {
      set(state, `messages[${index}]`, { ...state.messages[index], ...data });
      return { messages: state.messages };
    }),
}));

export default store;
