<template>
  <div>
    <main class="page">
      <h1>@chativa/vue2 example</h1>
      <p>
        <code>Vue.use(Chativa, { connector })</code> (see <code>main.js</code>) registers the
        connector and the global components. <code>&lt;ChatBotButton&gt;</code> renders a custom
        launcher from its default slot; <code>&lt;ChatIva&gt;</code> is the panel it opens. Every
        Chativa event below is a plain Vue <code>@event</code> listener.
      </p>

      <button class="action" @click="triggerWeather">Stream a GenUI weather card</button>

      <h2>Event log</h2>
      <ol class="log">
        <li v-for="(entry, i) in log" :key="i">{{ entry }}</li>
        <li v-if="!log.length" class="muted">Open the chat and say something.</li>
      </ol>

      <h2>Standalone <code>&lt;GenUIMessage&gt;</code></h2>
      <p>
        The <code>messageData</code> object is forwarded to <code>&lt;genui-message&gt;</code> as a
        DOM property, not a stringified attribute.
      </p>
      <GenUIMessage
        :message-data="alert"
        message-id="static-alert"
        hide-avatar
        @send-event="(detail) => record('send-event', detail)"
      />
    </main>

    <ChatBotButton>
      <button class="custom-launcher" aria-label="Open chat">Ask Iva</button>
    </ChatBotButton>

    <ChatIva
      @connect="record('connect')"
      @disconnect="(payload) => record('disconnect', payload)"
      @message="(message) => record('message', message.data)"
      @message-sent="(message) => record('message-sent', message.data)"
      @widget-open="record('widget-open')"
      @widget-close="record('widget-close')"
      @feedback="(detail) => record('feedback', detail)"
    />
  </div>
</template>

<script>
import { chatStore } from "@chativa/core";
import { dummy } from "./connector";

export default {
  name: "App",
  data() {
    return {
      log: [],
      alert: {
        chunks: [
          {
            type: "ui",
            component: "genui-alert",
            props: {
              variant: "success",
              title: "Rendered outside the chat",
              message: "A GenUI message embedded straight into a Vue 2 template.",
            },
            id: 1,
          },
        ],
        streamingComplete: true,
      },
    };
  },
  methods: {
    record(name, payload) {
      const suffix = payload === undefined ? "" : ` ${JSON.stringify(payload)}`;
      this.log.unshift(`${new Date().toLocaleTimeString()} ${name}${suffix}`);
    },
    // The engine (and DummyConnector's GenUI handler) only starts once the
    // panel has been opened — open it, then trigger once connected.
    triggerWeather() {
      const run = () => dummy.triggerGenUI("weather");
      if (chatStore.getState().connectorStatus === "connected") {
        chatStore.getState().open();
        run();
        return;
      }
      const unsubscribe = chatStore.subscribe((state) => {
        if (state.connectorStatus !== "connected") return;
        unsubscribe();
        run();
      });
      chatStore.getState().open();
    },
  },
};
</script>
