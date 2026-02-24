import { ConnectorRegistry } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";

// Register connector BEFORE UI loads so connectedCallback can find it
ConnectorRegistry.register(new DummyConnector({ replyDelay: 3000 }));

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");
