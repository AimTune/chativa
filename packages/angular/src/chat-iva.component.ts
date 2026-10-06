import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import { NgIf } from "@angular/common";
import {
  EventBus,
  chatStore,
  type ConnectorStatus,
  type EventBusEventName,
  type EventBusPayloadMap,
  type IConnector,
  type IncomingMessage,
  type OutgoingMessage,
  type SurveyPayload,
} from "@chativa/core";
import { ChativaElementHost } from "./internal/chativa-element-host";
import { resolveConnectorName } from "./internal/resolve-connector";

/** Payload of the `(disconnect)` output. */
export interface ChatIvaDisconnectEvent {
  status: ConnectorStatus;
}

/**
 * Angular wrapper for `<chat-iva>` — the main Chativa chat panel. It has no
 * launcher of its own; render `<chativa-chat-bot-button>` next to it for a
 * normal popup setup.
 *
 * The element is rendered only in the browser, once `@chativa/ui` has been
 * lazily imported, so the component is safe under Angular SSR.
 *
 * @example
 * ```html
 * <chativa-chat-iva [connector]="dummy" (message)="onMessage($event)" />
 * <chativa-chat-bot-button />
 * ```
 */
@Component({
  selector: "chativa-chat-iva",
  standalone: true,
  imports: [NgIf],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [":host { display: contents; }"],
  template: `<chat-iva #el *ngIf="loaded"><ng-content></ng-content></chat-iva>`,
})
export class ChatIvaComponent
  extends ChativaElementHost
  implements OnInit, OnDestroy
{
  private _fullscreenOnly = false;
  private readonly unsubscribers: Array<() => void> = [];

  /**
   * Connector name (already registered elsewhere) or an `IConnector` instance
   * to auto-register and activate. Defaults to whatever `ChativaService` /
   * `provideChativa()` (or `window.chativaSettings`) has activated.
   */
  @Input()
  set connector(value: string | IConnector | null | undefined) {
    const name = resolveConnectorName(value);
    if (name === undefined) return;
    // `<chat-iva>` resolves its connector while connecting, before any
    // property write could reach it, and prefers the store's
    // `activeConnector` — so the store is the one path that always works.
    if (chatStore.getState().activeConnector !== name) {
      chatStore.getState().setConnector(name);
    }
    this.bridge.setProperty("connector", name);
  }

  /**
   * Start in fullscreen and hide the fullscreen toggle — the `fullscreen-only`
   * attribute of `<chat-iva>`. Accepts a bare attribute
   * (`<chativa-chat-iva fullscreenOnly />`). `false` means "no opinion": it
   * never re-enables a fullscreen toggle the theme turned off.
   */
  @Input()
  set fullscreenOnly(value: boolean | "" | "true" | "false" | null | undefined) {
    const on = value === "" || value === true || value === "true";
    this._fullscreenOnly = on;
    if (!on) return;
    // Applied to the shared store for the same reason as `connector`: the
    // element picks its window mode while connecting.
    const theme = chatStore.getState();
    if (!theme.isFullscreen) theme.setFullscreen(true);
    if (theme.allowFullscreen) theme.setAllowFullscreen(false);
    this.bridge.setProperty("fullscreenOnly", true);
  }
  get fullscreenOnly(): boolean {
    return this._fullscreenOnly;
  }

  /** A bot/connector message was delivered. */
  @Output() readonly message = new EventEmitter<IncomingMessage>();
  /** The user sent a message. */
  @Output() readonly messageSent = new EventEmitter<OutgoingMessage>();
  /** The connector transitioned to `"connected"`. */
  @Output() readonly connect = new EventEmitter<void>();
  /** The connector transitioned to `"disconnected"` or `"error"`. */
  @Output() readonly disconnect = new EventEmitter<ChatIvaDisconnectEvent>();
  /** The end-of-conversation survey was submitted. */
  @Output() readonly surveySubmit = new EventEmitter<SurveyPayload>();
  /** The chat panel opened. */
  @Output() readonly widgetOpen = new EventEmitter<void>();
  /** The chat panel closed. */
  @Output() readonly widgetClose = new EventEmitter<void>();
  /**
   * `<chat-iva>` dispatched `chativa-reset` — it is about to rebuild its
   * engine after a survey. Swap the registered connector here to start the
   * next conversation with fresh credentials.
   */
  @Output() readonly chativaReset = new EventEmitter<void>();

  constructor() {
    super();
    this.bridge.listen("chativa-reset", () => this.emit(this.chativaReset, undefined));
  }

  override ngOnInit(): void {
    this.subscribe("message_received", (m) => this.emit(this.message, m));
    this.subscribe("message_sent", (m) => this.emit(this.messageSent, m));
    this.subscribe("survey_submitted", (p) => this.emit(this.surveySubmit, p));
    this.subscribe("widget_opened", () => this.emit(this.widgetOpen, undefined));
    this.subscribe("widget_closed", () => this.emit(this.widgetClose, undefined));
    this.subscribe("connector_status_changed", (payload) => {
      if (payload.status === "connected") this.emit(this.connect, undefined);
      else if (payload.status === "disconnected" || payload.status === "error") {
        this.emit(this.disconnect, payload);
      }
    });
    super.ngOnInit();
  }

  override ngOnDestroy(): void {
    this.unsubscribers.splice(0).forEach((off) => off());
    super.ngOnDestroy();
  }

  private subscribe<K extends EventBusEventName>(
    event: K,
    handler: (payload: EventBusPayloadMap[K]) => void,
  ): void {
    EventBus.on(event, handler);
    this.unsubscribers.push(() => EventBus.off(event, handler));
  }
}
