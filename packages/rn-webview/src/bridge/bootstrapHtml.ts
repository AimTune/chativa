import type { BuiltinConnectorType, ChativaWebViewSettings } from "./types";

/**
 * Maps a built-in connector type to its CDN/global (IIFE) build — same
 * artifact each package's own `vite.config.cdn.ts` produces and publishes
 * under the package's `jsdelivr` field.
 */
const BUILTIN_CONNECTORS: Record<
  BuiltinConnectorType,
  { pkg: string; file: string; globalName: string; className: string }
> = {
  dummy: {
    pkg: "@chativa/connector-dummy",
    file: "chativa-dummy.global.js",
    globalName: "ChativaDummy",
    className: "DummyConnector",
  },
  websocket: {
    pkg: "@chativa/connector-websocket",
    file: "chativa-websocket.global.js",
    globalName: "ChativaWebSocket",
    className: "WebSocketConnector",
  },
  signalr: {
    pkg: "@chativa/connector-signalr",
    file: "chativa-signalr.global.js",
    globalName: "ChativaSignalR",
    className: "SignalRConnector",
  },
  directline: {
    pkg: "@chativa/connector-directline",
    file: "chativa-directline.global.js",
    globalName: "ChativaDirectLine",
    className: "DirectLineConnector",
  },
  http: {
    pkg: "@chativa/connector-http",
    file: "chativa-http.global.js",
    globalName: "ChativaHttp",
    className: "HttpConnector",
  },
  sse: {
    pkg: "@chativa/connector-sse",
    file: "chativa-sse.global.js",
    globalName: "ChativaSse",
    className: "SseConnector",
  },
};

const DEFAULT_CDN_BASE_URL = "https://cdn.jsdelivr.net/npm";

/** JSON-encode a value for inlining into a `<script>` block, without letting `</script>` break out early. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export interface BuildBootstrapHtmlOptions {
  settings: ChativaWebViewSettings;
  /** Base URL scripts are resolved against. Default: jsdelivr's `@latest` tag for each package. */
  cdnBaseUrl?: string;
  /** Pin an exact version for a package instead of `@latest` (e.g. `{ core: "0.4.0" }`). */
  versions?: Partial<Record<"core" | "ui" | BuiltinConnectorType, string>>;
}

/**
 * Builds the self-contained HTML document loaded into the WebView: pulls in
 * the already-published `@chativa/core` + `@chativa/ui` (which itself pulls
 * in `@chativa/genui`) CDN builds plus whichever connector script the given
 * spec needs, constructs the connector, applies it via the same
 * `window.chativaSettings` convention `@chativa/core` already reads on the
 * web, mounts `<chat-iva>`, and bridges `EventBus` to
 * `ReactNativeWebView.postMessage`.
 */
export function buildBootstrapHtml({
  settings,
  cdnBaseUrl = DEFAULT_CDN_BASE_URL,
  versions = {},
}: BuildBootstrapHtmlOptions): string {
  const scriptUrl = (pkg: string, file: string, version?: string) =>
    `${cdnBaseUrl}/${pkg}@${version ?? "latest"}/dist/${file}`;

  const connectorScripts: string[] = [];
  let constructConnectorExpr: string;

  if (settings.connector.type === "custom") {
    const { scriptUrl: url, globalName, className, options } = settings.connector;
    connectorScripts.push(url);
    constructConnectorExpr = `new window[${inlineJson(globalName)}][${inlineJson(className)}](${inlineJson(options ?? {})})`;
  } else {
    const entry = BUILTIN_CONNECTORS[settings.connector.type];
    connectorScripts.push(scriptUrl(entry.pkg, entry.file, versions[settings.connector.type]));
    constructConnectorExpr = `new window[${inlineJson(entry.globalName)}][${inlineJson(entry.className)}](${inlineJson(settings.connector.options ?? {})})`;
  }

  const coreScript = scriptUrl("@chativa/core", "chativa-core.global.js", versions.core);
  const uiScript = scriptUrl("@chativa/ui", "chativa.global.js", versions.ui);

  const scriptTags = [coreScript, ...connectorScripts, uiScript]
    .map((src) => `<script src="${src}"></script>`)
    .join("\n    ");

  return /* html */ `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
      chat-iva { display: block; height: 100%; }
    </style>
  </head>
  <body>
    ${scriptTags}
    <script>
      (function () {
        window.chativaSettings = {
          connector: ${constructConnectorExpr},
          theme: ${inlineJson({ ...(settings.theme ?? {}), windowMode: "inline", allowFullscreen: false })},
          locale: ${inlineJson(settings.locale)},
          i18n: ${inlineJson(settings.i18n)}
        };

        function post(message) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        }

        function bridgeEvents() {
          var EventBus = window.ChativaCore.EventBus;
          var chatStore = window.ChativaCore.chatStore;

          EventBus.on("message_received", function (payload) { post({ type: "message_received", payload: payload }); });
          EventBus.on("message_sent", function (payload) { post({ type: "message_sent", payload: payload }); });
          EventBus.on("connector_status_changed", function (payload) { post({ type: "connector_status_changed", payload: payload }); });
          EventBus.on("survey_submitted", function (payload) { post({ type: "survey_submitted", payload: payload }); });
          EventBus.on("widget_opened", function () { post({ type: "widget_opened" }); });
          EventBus.on("widget_closed", function () { post({ type: "widget_closed" }); });

          // Inline mode + no launcher button: the widget is the whole screen,
          // so it should already be "open" rather than waiting for a tap.
          chatStore.getState().open();

          function handleInbound(event) {
            var data;
            try { data = JSON.parse(event.data); } catch (e) { return; }
            if (data && data.type === "set_theme") {
              chatStore.getState().setTheme(data.payload || {});
            }
          }
          document.addEventListener("message", handleInbound);
          window.addEventListener("message", handleInbound);

          post({ type: "ready" });
        }

        try {
          bridgeEvents();
        } catch (err) {
          post({ type: "error", payload: { message: String(err && err.message ? err.message : err) } });
        }
      })();
    </script>
    <chat-iva></chat-iva>
  </body>
</html>`;
}
