import { ConnectorRegistry } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";

// Register connector BEFORE UI loads so connectedCallback can find it
const connector = new DummyConnector({ replyDelay: 500 });
ConnectorRegistry.register(connector);

// Expose inject helper for sandbox demo buttons
(window as Record<string, unknown>).chativaInject = connector.injectMessage.bind(connector);

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");
