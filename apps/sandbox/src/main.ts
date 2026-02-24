import { ConnectorRegistry } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import { GenUIRegistry } from "@chativa/genui";
import { WeatherWidget } from "./components/WeatherWidget";
import { AIAppointmentForm } from "./components/AIForm";

// Register connector BEFORE UI loads so connectedCallback can find it
const connector = new DummyConnector({ replyDelay: 500 });
ConnectorRegistry.register(connector);

// Register custom GenUI components
GenUIRegistry.register("weather", WeatherWidget);
GenUIRegistry.register("appointment-form", AIAppointmentForm);

// Expose inject helper for sandbox demo buttons
(window as unknown as Record<string, unknown>).chativaInject = connector.injectMessage.bind(connector);

// Expose genui trigger — calls the appropriate stream demo on the connector
(window as unknown as Record<string, unknown>).chativaGenUI = (command: string) => {
  connector.triggerGenUI(command);
};

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");
