import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
  ChatBotButtonComponent,
  ChatIvaComponent,
  ChativaService,
  GenUIMessageComponent,
  type ChatIvaDisconnectEvent,
  type GenUISendEventDetail,
  type IncomingMessage,
  type OutgoingMessage,
} from "@chativa/angular";
import { dummy } from "./app.config";

@Component({
  selector: "app-root",
  imports: [ChatIvaComponent, ChatBotButtonComponent, GenUIMessageComponent],
  template: `
    <main class="page">
      <h1>&#64;chativa/angular example</h1>
      <p>
        <code>provideChativa()</code> registers the connector and theme once;
        <code>&lt;chativa-chat-bot-button&gt;</code> renders a custom launcher
        projected into its slot; <code>&lt;chativa-chat-iva&gt;</code> is the panel it opens.
        This app runs <strong>zoneless</strong> — the log below is updated from the
        wrapper's outputs through signals.
      </p>

      <p>Connector status: <code>{{ status() }}</code></p>

      <button class="trigger-genui" type="button" (click)="triggerChart()">
        Open the chat and stream a GenUI chart
      </button>

      <h2>Event log</h2>
      @if (log().length === 0) {
        <p class="muted">Open the chat and send a message.</p>
      } @else {
        <ol class="log">
          @for (entry of log(); track $index) {
            <li>{{ entry }}</li>
          }
        </ol>
      }

      <h2>Standalone GenUI message</h2>
      <p>
        <code>&lt;chativa-genui-message&gt;</code> renders one GenUI payload outside the
        chat panel — <code>[messageData]</code> is written to the element as an object property.
      </p>
      <chativa-genui-message
        messageId="standalone-demo"
        [messageData]="standaloneMessage"
        (genuiSendEvent)="onGenUIEvent($event)"
      />
    </main>

    <chativa-chat-bot-button>
      <button class="custom-launcher" type="button" aria-label="Open chat">
        <span class="custom-launcher-icon" aria-hidden="true">💬</span>
        Ask Iva
      </button>
    </chativa-chat-bot-button>

    <chativa-chat-iva
      (message)="onMessage($event)"
      (messageSent)="onMessageSent($event)"
      (connect)="status.set('connected')"
      (disconnect)="onDisconnect($event)"
      (widgetOpen)="push('widget opened')"
      (widgetClose)="push('widget closed')"
    />
  `,
})
export class App {
  private readonly chativa = inject(ChativaService);

  protected readonly status = signal("idle");
  protected readonly log = signal<string[]>([]);

  protected readonly standaloneMessage = {
    chunks: [
      { type: "text", id: 1, content: "Rendered outside the chat panel by **chativa-genui-message**:" },
      {
        type: "ui",
        id: 2,
        component: "genui-alert",
        props: {
          variant: "success",
          title: "Hello from Angular",
          message: "Any registered GenUI component can be embedded this way.",
        },
      },
    ],
    streamingComplete: true,
  };

  constructor() {
    // ChativaService.on() — any EventBus event, cleaned up with the component.
    const off = this.chativa.on("genui_stream_completed", ({ streamId }) =>
      this.push(`GenUI stream completed (${streamId})`),
    );
    inject(DestroyRef).onDestroy(off);
  }

  protected onMessage(message: IncomingMessage): void {
    const text = (message.data as { text?: string } | undefined)?.text;
    this.push(`bot: ${text ?? `[${message.type}]`}`);
  }

  protected onMessageSent(message: OutgoingMessage): void {
    const text = (message.data as { text?: string } | undefined)?.text;
    this.push(`you: ${text ?? `[${message.type}]`}`);
  }

  protected onDisconnect(event: ChatIvaDisconnectEvent): void {
    this.status.set(event.status);
  }

  protected onGenUIEvent(detail: GenUISendEventDetail): void {
    this.push(`GenUI event "${detail.eventType}" from ${detail.msgId}`);
  }

  /**
   * The engine only connects once the panel has been opened, so open it and
   * wait for "connected" before asking the dummy connector to stream.
   */
  protected triggerChart(): void {
    if (this.status() === "connected") {
      this.chativa.open();
      dummy.triggerGenUI("chart");
      return;
    }
    const off = this.chativa.on("connector_status_changed", ({ status }) => {
      if (status !== "connected") return;
      off();
      dummy.triggerGenUI("chart");
    });
    this.chativa.open();
  }

  protected push(entry: string): void {
    this.log.update((entries) => [...entries.slice(-19), entry]);
  }
}
