import { useCallback, useMemo } from "react";
import { ChativaProvider, ChatIva, ChatBotButton } from "@chativa/react";
import { DummyConnector } from "@chativa/connector-dummy";
import { EventBus, chatStore, type ConnectorStatus } from "@chativa/core";
// Side-effect imports: register the custom GenUI components (see those
// files for why they're plain HTMLElement, not Lit or React).
import "./CustomWeatherCard";
import "./CustomPollCard";

/**
 * `<ChatIva>` is only the chat *panel* — it has no launcher of its own.
 * `<ChatBotButton>` is the toggle, and its default slot lets you swap the
 * built-in gradient circle for a fully custom element. This is the "custom
 * chatbot element" pattern: whatever you put inside `<ChatBotButton>` becomes
 * the launcher, while `<ChatBotButton>` itself still handles positioning and
 * the open/close click — you don't have to reimplement that part.
 */
function CustomLauncher() {
  return (
    <button className="custom-launcher" aria-label="Open chat">
      <span className="custom-launcher-icon" aria-hidden="true">
        💬
      </span>
      Ask Iva
    </button>
  );
}

export default function App() {
  // A stable instance — re-creating the connector on every render would
  // register a new one each time and throw ("already registered").
  // connectDelay: 0 skips DummyConnector's default 2s fake-handshake delay,
  // since this demo's trigger button already waits for a real "connected"
  // status rather than guessing at a timeout.
  const dummy = useMemo(() => new DummyConnector({ replyDelay: 500, connectDelay: 0 }), []);

  // The chat engine only connects (and DummyConnector only registers its
  // GenUI handler) once the panel has been opened at least once — that's
  // when `<ChatIva>` lazily calls `connector.connect()`. Open the panel and
  // wait for `connector_status_changed: "connected"` before running `fn`,
  // instead of guessing at a delay.
  const runOnceConnected = useCallback((fn: () => void) => {
    if (chatStore.getState().connectorStatus === "connected") {
      fn();
      chatStore.getState().open();
      return;
    }
    const onStatus = (payload: { status: ConnectorStatus }) => {
      if (payload.status !== "connected") return;
      EventBus.off("connector_status_changed", onStatus);
      fn();
    };
    EventBus.on("connector_status_changed", onStatus);
    chatStore.getState().open();
  }, []);

  const triggerWeatherDemo = useCallback(() => {
    runOnceConnected(() => dummy.triggerGenUI("weather"));
  }, [dummy, runOnceConnected]);

  // Unlike the weather demo (DummyConnector's own built-in stream), this
  // builds the GenUI chunk list by hand and injects it directly — the
  // question/options *payload* is passed in at the call site below, not
  // hardcoded inside the component or a connector method.
  const triggerPollDemo = useCallback(
    (payload: { question: string; options: string[] }) => {
      runOnceConnected(() => {
        dummy.injectMessage({
          type: "genui",
          from: "bot",
          data: {
            chunks: [{ type: "ui", component: "poll", props: payload, id: 1 }],
            streamingComplete: true,
          },
        });
      });
    },
    [dummy, runOnceConnected],
  );

  return (
    <ChativaProvider
      connector={dummy}
      theme={{
        colors: { primary: "#7c3aed", secondary: "#4f46e5" },
        // Hide the (custom) launcher while the panel is open — otherwise
        // both would be visible at once.
        hideButtonOnOpen: true,
      }}
    >
      <main className="page">
        <h1>@chativa/react example</h1>
        <p>
          <code>ChativaProvider</code> registers the connector + theme once;
          <code> ChatBotButton</code> renders a custom launcher element (see{" "}
          <code>CustomLauncher</code> below) instead of the default icon;{" "}
          <code>ChatIva</code> is the panel it opens.
        </p>
        <p>
          <code>CustomWeatherCard</code> is a custom GenUI component — a
          plain Custom Element (no Lit, no React) registered via{" "}
          <code>GenUIRegistry.register(&quot;weather&quot;, ...)</code>.
          Click below to open the chat and stream one in.
        </p>
        <button className="trigger-genui" onClick={triggerWeatherDemo}>
          Trigger custom GenUI (weather)
        </button>
        <p>
          <code>CustomPollCard</code> is a second, interactive custom GenUI
          component — clicking an option calls the injected{" "}
          <code>sendEvent()</code>, which reaches the connector via{" "}
          <code>ChatEngine.receiveComponentEvent()</code>.
        </p>
        <button
          className="trigger-genui"
          onClick={() =>
            triggerPollDemo({
              question: "How's this example so far?",
              options: ["🎉 Great", "🤔 Needs work", "🙁 Confusing"],
            })
          }
        >
          Trigger custom GenUI (poll)
        </button>
      </main>

      <ChatBotButton>
        <CustomLauncher />
      </ChatBotButton>

      <ChatIva
        onMessage={(message) => console.log("[chativa] message received:", message)}
        onMessageSent={(message) => console.log("[chativa] message sent:", message)}
        onWidgetOpen={() => console.log("[chativa] widget opened")}
        onWidgetClose={() => console.log("[chativa] widget closed")}
      />
    </ChativaProvider>
  );
}
