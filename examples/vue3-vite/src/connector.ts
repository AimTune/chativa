import { DummyConnector } from "@chativa/connector-dummy";

// One connector instance for the whole app — re-creating it would try to
// register the same name twice. connectDelay: 0 skips DummyConnector's
// default 2s fake handshake.
export const dummy = new DummyConnector({ replyDelay: 500, connectDelay: 0 });
