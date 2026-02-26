import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";

// Register a connector for the live preview widget
const connector = new DummyConnector({ name: "theme-preview", replyDelay: 600 });
ConnectorRegistry.register(connector);

// Open the widget by default so the preview is immediately visible
chatStore.getState().open();

// Dynamic import ensures custom elements are defined after registration
import("@chativa/ui");

// Import the theme editor component
import("./theme-editor/ThemeEditorApp");
