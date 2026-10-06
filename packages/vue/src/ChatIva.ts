import { defineComponent, shallowRef, watch, type PropType } from "vue";
import { chatStore } from "@chativa/core";
import type {
  IConnector,
  IncomingMessage,
  OutgoingMessage,
  SurveyPayload,
  ConnectorStatus,
} from "@chativa/core";
import { loadChativaUi } from "./internal/loadChativaUi";
import { renderCustomElement, useLazyElement } from "./internal/element";
import { resolveConnectorName } from "./internal/resolveConnector";
import { canUseDOM } from "./internal/env";
import { useChativaEvent } from "./composables/useChativaEvent";

/** Props accepted by {@link ChatIva}. */
export interface ChatIvaProps {
  /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and use. Defaults to whatever `ChativaPlugin` (or `window.chativaSettings`) has activated. */
  connector?: string | IConnector;
  /**
   * Start in fullscreen and hide the fullscreen toggle. Equivalent to the
   * `fullscreen-only` HTML attribute on `<chat-iva>`. `false` means "no
   * opinion" — it never re-enables a toggle the theme turned off.
   */
  fullscreenOnly?: boolean;
}

/**
 * Vue wrapper for `<chat-iva>` — the Chativa chat panel. Renders a comment
 * placeholder until `@chativa/ui` has been loaded on the client, so it is safe
 * to render during SSR (Nuxt) without `<ClientOnly>`.
 *
 * Widget activity is re-emitted as typed Vue events (sourced from the shared
 * `EventBus`, exactly like `@chativa/react`'s `on*` props), and the element's
 * own `chativa-reset` DOM event is re-emitted as `chativaReset`.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { ChatIva } from "@chativa/vue";
 * import { DummyConnector } from "@chativa/connector-dummy";
 * const dummy = new DummyConnector();
 * </script>
 *
 * <template>
 *   <ChatIva :connector="dummy" @message="(m) => console.log(m)" />
 * </template>
 * ```
 */
export const ChatIva = defineComponent({
  name: "ChatIva",
  props: {
    connector: {
      type: [String, Object] as PropType<string | IConnector>,
      default: undefined,
    },
    fullscreenOnly: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    /** A bot/connector message was delivered. */
    message: (_message: IncomingMessage) => true,
    /** The user sent a message. */
    messageSent: (_message: OutgoingMessage) => true,
    /** The connector transitioned to `"connected"`. */
    connect: () => true,
    /** The connector transitioned to `"disconnected"` or `"error"`. */
    disconnect: (_payload: { status: ConnectorStatus }) => true,
    /** The end-of-conversation survey was submitted. */
    surveySubmit: (_payload: SurveyPayload) => true,
    /** The chat panel opened. */
    widgetOpen: () => true,
    /** The chat panel closed. */
    widgetClose: () => true,
    /** `<chat-iva>`'s `chativa-reset` DOM event — the conversation is about to be rebuilt after a survey. */
    chativaReset: () => true,
  },
  setup(props, { emit, slots, expose }) {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    // `<chat-iva>` resolves its connector — and its window mode — synchronously
    // in `connectedCallback`, which runs as soon as Vue inserts the element and
    // *before* any later property patch could land. Writing to the shared
    // `chatStore` here in `setup()` (i.e. before the element exists) is the one
    // path that is guaranteed to win; `ChatWidget` prefers
    // `chatStore.activeConnector` over its own `connector` property. Skipped on
    // the server: nothing connects there, and the store is a process-wide
    // singleton shared by every request.
    const applyConnector = (connector: string | IConnector | undefined): string | undefined => {
      if (!canUseDOM()) return undefined;
      const name = resolveConnectorName(connector);
      if (name !== undefined && chatStore.getState().activeConnector !== name) {
        chatStore.getState().setConnector(name);
      }
      return name;
    };

    const applyFullscreenOnly = (fullscreenOnly: boolean) => {
      if (!fullscreenOnly || !canUseDOM()) return;
      const theme = chatStore.getState();
      if (!theme.isFullscreen) theme.setFullscreen(true);
      if (theme.allowFullscreen) theme.setAllowFullscreen(false);
    };

    const connectorName = shallowRef(applyConnector(props.connector));
    applyFullscreenOnly(props.fullscreenOnly);

    watch(
      () => props.connector,
      (connector) => {
        connectorName.value = applyConnector(connector);
      },
    );
    watch(() => props.fullscreenOnly, applyFullscreenOnly);

    useChativaEvent("message_received", (message) => emit("message", message));
    useChativaEvent("message_sent", (message) => emit("messageSent", message));
    useChativaEvent("survey_submitted", (payload) => emit("surveySubmit", payload));
    useChativaEvent("widget_opened", () => emit("widgetOpen"));
    useChativaEvent("widget_closed", () => emit("widgetClose"));
    useChativaEvent("connector_status_changed", (payload) => {
      if (payload.status === "connected") emit("connect");
      else if (payload.status === "disconnected" || payload.status === "error") {
        emit("disconnect", payload);
      }
    });

    const ready = useLazyElement(loadChativaUi);

    return () =>
      ready.value
        ? renderCustomElement(
            "chat-iva",
            {
              ref: element,
              domProps: { connector: connectorName.value },
              domEvents: { "chativa-reset": () => emit("chativaReset") },
            },
            slots.default?.(),
          )
        : null;
  },
});
