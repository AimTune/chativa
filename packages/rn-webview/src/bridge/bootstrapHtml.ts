import type {
  BuiltinConnectorType,
  ChativaWebViewSettings,
  MekikConnectorSpecOptions,
} from "./types";

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
  mekik: {
    pkg: "@chativa/connector-mekik",
    file: "chativa-mekik.global.js",
    globalName: "ChativaMekik",
    className: "MekikConnector",
  },
};

const DEFAULT_CDN_BASE_URL = "https://cdn.jsdelivr.net/npm";

/** JSON-encode a value for inlining into a `<script>` block, without letting `</script>` break out early. */
function inlineJson(value: unknown): string {
  const json = JSON.stringify(value);
  // JSON.stringify(undefined) is undefined (not a string) — inline the literal
  // so an omitted setting stays absent instead of throwing here.
  return json === undefined ? "undefined" : json.replace(/</g, "\\u003c");
}

/**
 * The mekik connector can't go through the generic `new g.MekikConnector(json)`
 * path: its `auth` option is a class instance (`TokenAuth` / `CookieAuth`), and
 * serializing one would produce a methodless plain object the connector can't
 * call. Instead the JSON-safe `MekikAuthSpec` is rebuilt into a real adapter
 * inside the WebView, and `onAuthError` (a callback, also unbridgeable) is
 * wired here to surface rejections as `auth_error` bridge messages.
 */
function mekikConnectorExpr(options: MekikConnectorSpecOptions): string {
  const { auth, ...rest } = options;
  let authStmt = "";
  if (auth?.kind === "token") {
    const { kind: _kind, ...tokenOpts } = auth;
    authStmt = `o.auth = new g.TokenAuth(${inlineJson(tokenOpts)});`;
  } else if (auth?.kind === "cookie") {
    authStmt = `o.auth = new g.CookieAuth();`;
  }
  return `(function () {
          var g = window["ChativaMekik"];
          var o = ${inlineJson(rest)};
          ${authStmt}
          o.onAuthError = function (e) { post({ type: "auth_error", payload: { code: e.code, message: e.message } }); };
          return new g.MekikConnector(o);
        })()`;
}

export interface BuildBootstrapHtmlOptions {
  settings: ChativaWebViewSettings;
  /** Base URL scripts are resolved against. Default: jsdelivr's `@latest` tag for each package. */
  cdnBaseUrl?: string;
  /** Pin an exact version for a package instead of `@latest` (e.g. `{ ui: "0.10.0" }`). */
  versions?: Partial<Record<"ui" | BuiltinConnectorType, string>>;
}

/**
 * Builds the self-contained HTML document loaded into the WebView: pulls in
 * the already-published `@chativa/ui` CDN build (which bundles
 * `@chativa/core` + `@chativa/genui`) plus whichever connector script the
 * given spec needs, constructs the connector, applies it via the same
 * `window.chativaSettings` convention `@chativa/core` already reads on the
 * web, mounts `<chat-iva>`, and bridges `EventBus` to
 * `ReactNativeWebView.postMessage`.
 *
 * The bridge binds to `window.Chativa.EventBus` / `window.Chativa.chatStore`
 * — the singletons *inside* the ui bundle, i.e. the exact instances
 * `<chat-iva>` uses. (Binding to a separately loaded `chativa-core.global.js`
 * would observe a second, disconnected copy of core: every callback would
 * silently never fire.) Requires `@chativa/ui` >= 0.10.
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
    constructConnectorExpr =
      settings.connector.type === "mekik"
        ? mekikConnectorExpr(settings.connector.options)
        : `new window[${inlineJson(entry.globalName)}][${inlineJson(entry.className)}](${inlineJson(settings.connector.options ?? {})})`;
  }

  const uiScript = scriptUrl("@chativa/ui", "chativa.global.js", versions.ui);

  const scriptTags = [...connectorScripts, uiScript]
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
        function post(message) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        }

        window.chativaSettings = {
          connector: ${constructConnectorExpr},
          theme: ${inlineJson({ ...(settings.theme ?? {}), windowMode: "inline", allowFullscreen: false })},
          locale: ${inlineJson(settings.locale)},
          i18n: ${inlineJson(settings.i18n)}
        };

        function bridgeEvents() {
          var C = window.Chativa;
          if (!C || !C.EventBus || !C.chatStore) {
            post({ type: "error", payload: { message: "@chativa/ui >= 0.10 required: EventBus/chatStore missing from window.Chativa" } });
            return;
          }
          var EventBus = C.EventBus;
          var chatStore = C.chatStore;

          EventBus.on("message_received", function (payload) { post({ type: "message_received", payload: payload }); });
          EventBus.on("message_sent", function (payload) { post({ type: "message_sent", payload: payload }); });
          EventBus.on("connector_status_changed", function (payload) { post({ type: "connector_status_changed", payload: payload }); });
          EventBus.on("survey_submitted", function (payload) { post({ type: "survey_submitted", payload: payload }); });
          EventBus.on("widget_opened", function () { post({ type: "widget_opened" }); });
          EventBus.on("widget_closed", function () { post({ type: "widget_closed" }); });
          EventBus.on("genui_components_registered", function (payload) {
            var defs = (payload && payload.definitions) || [];
            post({ type: "genui_components_registered", payload: { components: defs.map(function (d) {
              return { name: d.name, version: d.version, tag: d.tag };
            }) } });
          });
          EventBus.on("genui_stream_started", function (payload) { post({ type: "genui_stream_started", payload: payload }); });
          EventBus.on("genui_stream_completed", function (payload) { post({ type: "genui_stream_completed", payload: payload }); });
          EventBus.on("tool_call_updated", function (payload) { post({ type: "tool_call_updated", payload: payload }); });

          // Inline mode + no launcher button: the widget is the whole screen,
          // so it should already be "open" rather than waiting for a tap.
          chatStore.getState().open();

          function handleInbound(event) {
            var data;
            try { data = JSON.parse(event.data); } catch (e) { return; }
            if (!data || !data.type) return;
            switch (data.type) {
              case "set_theme":
                chatStore.getState().setTheme(data.payload || {});
                break;
              case "send_message": {
                var widget = document.querySelector("chat-iva");
                if (widget && data.payload && data.payload.text) {
                  widget.dispatchEvent(new CustomEvent("chat-action", {
                    detail: { text: data.payload.text, markdown: !!data.payload.markdown }
                  }));
                }
                break;
              }
              case "open_widget":
                chatStore.getState().open();
                break;
              case "close_widget":
                chatStore.getState().close();
                break;
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
