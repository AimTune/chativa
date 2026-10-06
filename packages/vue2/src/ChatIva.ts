import { defineComponent, h, ref, watch, onBeforeMount, type PropType } from "vue";
import { chatStore, type IConnector } from "@chativa/core";
import { loadChativaUi } from "./internal/loadChativaUi";
import { resolveConnectorName } from "./internal/resolveConnector";
import { useLoaded } from "./internal/useLoaded";
import { renderElement, detailOf } from "./internal/renderElement";
import { useChativaEvent } from "./composables/useChativaEvent";

/**
 * Vue 2.7 wrapper for `<chat-iva>` — the Chativa chat panel.
 *
 * Renders nothing until `@chativa/ui` has been dynamically imported on the
 * client (`mounted()`), so it is safe to include in a server-rendered Nuxt 2
 * tree. `<chat-iva>` has no launcher of its own — render `<ChatBotButton>`
 * next to it for the usual popup setup.
 *
 * Events (all `$emit`ted, listen with `@message`, `@widget-open`, …):
 *
 * | Vue event        | Payload                          | Source                                            |
 * |------------------|----------------------------------|---------------------------------------------------|
 * | `message`        | `IncomingMessage`                | `EventBus` `message_received`                     |
 * | `message-sent`   | `OutgoingMessage`                | `EventBus` `message_sent`                         |
 * | `connect`        | —                                | `EventBus` `connector_status_changed` → connected |
 * | `disconnect`     | `{ status: ConnectorStatus }`    | … → `disconnected` / `error`                      |
 * | `survey-submit`  | `SurveyPayload`                  | `EventBus` `survey_submitted`                     |
 * | `widget-open`    | —                                | `EventBus` `widget_opened`                        |
 * | `widget-close`   | —                                | `EventBus` `widget_closed`                        |
 * | `feedback`       | `{ messageId, feedback }`        | DOM `chativa-feedback` CustomEvent                |
 * | `reset`          | —                                | DOM `chativa-reset` CustomEvent                   |
 *
 * @example
 * ```vue
 * <ChatIva :connector="dummy" @message="onMessage" />
 * ```
 */
export const ChatIva = defineComponent({
  name: "ChatIva",
  props: {
    /** Connector name (already registered elsewhere) or an `IConnector` instance to auto-register and use. Defaults to whatever the plugin (or `window.chativaSettings`) activated. */
    connector: {
      type: [String, Object] as PropType<string | IConnector>,
      default: undefined,
    },
    /** Start in fullscreen and hide the fullscreen toggle (the `fullscreen-only` attribute). `false` means "no opinion". */
    fullscreenOnly: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { emit, slots }) {
    const connectorName = ref<string | undefined>(undefined);

    // Pushed into the shared `chatStore` rather than only handed to the
    // element as properties: `<chat-iva>` reads `chatStore.activeConnector`
    // in preference to its own `connector` property, and decides its window
    // mode while connecting. Runs in `onBeforeMount` (never on the server),
    // well before the lazily rendered element connects.
    const apply = () => {
      const name = resolveConnectorName(props.connector);
      if (name !== undefined && chatStore.getState().activeConnector !== name) {
        chatStore.getState().setConnector(name);
      }
      if (props.fullscreenOnly) {
        const theme = chatStore.getState();
        if (!theme.isFullscreen) theme.setFullscreen(true);
        if (theme.allowFullscreen) theme.setAllowFullscreen(false);
      }
      connectorName.value = name;
    };
    onBeforeMount(apply);
    watch(() => [props.connector, props.fullscreenOnly], apply);

    useChativaEvent("message_received", (message) => emit("message", message));
    useChativaEvent("message_sent", (message) => emit("message-sent", message));
    useChativaEvent("survey_submitted", (payload) => emit("survey-submit", payload));
    useChativaEvent("widget_opened", () => emit("widget-open"));
    useChativaEvent("widget_closed", () => emit("widget-close"));
    useChativaEvent("connector_status_changed", (payload) => {
      if (payload.status === "connected") emit("connect");
      else if (payload.status === "disconnected" || payload.status === "error") emit("disconnect", payload);
    });

    const ready = useLoaded(loadChativaUi);

    return () => {
      if (!ready.value) return h();
      return renderElement(
        "chat-iva",
        {
          domProps: connectorName.value !== undefined ? { connector: connectorName.value } : {},
          on: {
            "chativa-feedback": (event: Event) => emit("feedback", detailOf(event)),
            "chativa-reset": () => emit("reset"),
          },
        },
        slots.default?.(),
      );
    };
  },
});
