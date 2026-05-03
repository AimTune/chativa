import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    "getting-started",
    "concepts",
    {
      type: "category",
      label: "Architecture",
      collapsed: false,
      items: ["architecture", "configuration", "theming"],
    },
    {
      type: "category",
      label: "Connectors",
      link: { type: "doc", id: "connectors/overview" },
      items: [
        "connectors/dummy",
        "connectors/websocket",
        "connectors/signalr",
        "connectors/directline",
        "connectors/sse",
        "connectors/http",
        "connectors/custom",
      ],
    },
    {
      type: "category",
      label: "Message types",
      link: { type: "doc", id: "message-types/overview" },
      items: ["message-types/built-in", "message-types/custom"],
    },
    {
      type: "category",
      label: "Generative UI",
      link: { type: "doc", id: "genui/overview" },
      items: [
        "genui/streaming",
        "genui/built-in",
        "genui/custom-component",
      ],
    },
    {
      type: "category",
      label: "Extensibility",
      items: ["extensions", "slash-commands"],
    },
    {
      type: "category",
      label: "Features",
      items: [
        "survey",
        "multi-conversation",
        "i18n",
      ],
    },
    {
      type: "category",
      label: "Tools",
      items: ["sandbox", "chrome-extension"],
    },
  ],
};

export default sidebars;
