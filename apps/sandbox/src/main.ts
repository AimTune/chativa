import { ConnectorRegistry, ExtensionRegistry, LinkPreviewExtension } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import { GenUIRegistry } from "@chativa/genui";
import { WeatherWidget } from "./components/WeatherWidget";
import { AIAppointmentForm } from "./components/AIForm";
import { OrderCard } from "./components/OrderCard";
import type { LinkMetadata } from "@chativa/ui";

// Register connector BEFORE UI loads so connectedCallback can find it
const connector = new DummyConnector({ replyDelay: 500 });
ConnectorRegistry.register(connector);

// Register custom GenUI components
GenUIRegistry.register("weather", WeatherWidget);
GenUIRegistry.register("genui-appointment-form", AIAppointmentForm as unknown as typeof HTMLElement);
GenUIRegistry.register("order-card", OrderCard);

// Install link preview extension by default
ExtensionRegistry.install(new LinkPreviewExtension({ maxUrlsPerMessage: 3 }));

// Mock metadata fetcher for sandbox demos
const mockMetadata: Record<string, LinkMetadata> = {
  "https://github.com": {
    title: "GitHub: Let's build from here",
    description: "GitHub is where over 100 million developers shape the future of software, together.",
    image: "https://github.githubassets.com/images/modules/site/social-cards/github-social.png",
    domain: "github.com",
  },
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ": {
    title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    description: 'The official video for "Never Gonna Give You Up" by Rick Astley.',
    image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    domain: "youtube.com",
  },
  "https://lit.dev": {
    title: "Lit - A simple library for building fast, lightweight web components",
    description: "Lit is a simple library for building fast, lightweight web components.",
    image: "https://lit.dev/images/logo.svg",
    domain: "lit.dev",
  },
  "https://developer.mozilla.org": {
    title: "MDN Web Docs",
    description: "The MDN Web Docs site provides information about Open Web technologies.",
    image: "https://developer.mozilla.org/mdn-social-share.cd6c4a5a.png",
    domain: "developer.mozilla.org",
  },
  "https://example.com": {
    title: "Example Domain",
    description: "This domain is for use in illustrative examples in documents.",
    domain: "example.com",
  },
};

const metadataFetcher = async (url: string): Promise<LinkMetadata> => {
  // Try exact match first
  if (mockMetadata[url]) return mockMetadata[url];

  // Try base URL match
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    if (mockMetadata[baseUrl]) return mockMetadata[baseUrl];

    // Fallback: return domain-only metadata
    return {
      domain: urlObj.hostname,
      title: urlObj.hostname,
    };
  } catch {
    return { domain: url };
  }
};

// Expose inject helper for sandbox demo buttons
(window as unknown as Record<string, unknown>).chativaInject = connector.injectMessage.bind(connector);

// Expose genui trigger — calls the appropriate stream demo on the connector
(window as unknown as Record<string, unknown>).chativaGenUI = (command: string) => {
  connector.triggerGenUI(command);
};

// Expose metadata fetcher for link preview cards
(window as unknown as Record<string, unknown>).chativaMetadataFetcher = metadataFetcher;

// Expose tool-call demo trigger for sandbox demo buttons
(window as unknown as Record<string, unknown>).chativaToolDemo = (scenario: "success" | "error" | "multi" | "genui") =>
  connector.triggerToolCalls(scenario);

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");
