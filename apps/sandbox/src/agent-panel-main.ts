import { ConnectorRegistry } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import { GenUIRegistry } from "@chativa/genui";
import { WeatherWidget } from "./components/WeatherWidget";
import { AIAppointmentForm } from "./components/AIForm";

// Use a separate connector instance named "dummy-agent" so it is
// independent from the chat-widget connector registered in main.ts.
const connector = new DummyConnector({
  name: "dummy-agent",
  replyDelay: 500,
  connectDelay: 500,
});
ConnectorRegistry.register(connector);

// Register the same custom GenUI components
GenUIRegistry.register("weather", WeatherWidget);
GenUIRegistry.register("genui-appointment-form", AIAppointmentForm as unknown as typeof HTMLElement);

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");
