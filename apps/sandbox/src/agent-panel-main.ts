import { ConnectorRegistry } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import { ConvergerConnector } from "@chativa/connector-converger";
import { GenUIRegistry } from "@chativa/genui";
import { WeatherWidget } from "./components/WeatherWidget";
import { AIAppointmentForm } from "./components/AIForm";
import { convergerSocketUrl, convergerTokenAuth } from "./sandbox/convergerToken";

// `agent-panel.html?converger=http://localhost:4000` runs the panel against a
// Converger hub: a channel-scoped token (minted by the dev server's
// /api/converger-token) lists the channel's conversations, and each one opens
// with a conversation-bound token. Without the parameter: the dummy connector.
const convergerBase = new URLSearchParams(location.search).get("converger");

if (convergerBase) {
  const connector = new ConvergerConnector({
    url: convergerSocketUrl(convergerBase),
    auth: convergerTokenAuth({ userId: "sandbox-agent", scope: "channel" }),
    channelScoped: true,
  });
  ConnectorRegistry.register(connector);
  document.querySelector("agent-panel")?.setAttribute("connector", connector.name);
} else {
  // Use a separate connector instance named "dummy-agent" so it is
  // independent from the chat-widget connector registered in main.ts.
  const connector = new DummyConnector({
    name: "dummy-agent",
    replyDelay: 500,
    connectDelay: 500,
  });
  ConnectorRegistry.register(connector);
}

// Register the same custom GenUI components
GenUIRegistry.register("weather", WeatherWidget);
GenUIRegistry.register("genui-appointment-form", AIAppointmentForm as unknown as typeof HTMLElement);

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");
