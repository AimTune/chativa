import { DummyConnector } from "@chativa/connector-dummy";

// One connector instance for the whole app — handed to `Vue.use(Chativa)` in
// main.js and used directly by App.vue's demo button. connectDelay: 0 skips
// DummyConnector's default 2s fake handshake.
export const dummy = new DummyConnector({ replyDelay: 500, connectDelay: 0 });
