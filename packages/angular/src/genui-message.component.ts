import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import { NgIf } from "@angular/common";
import type { GenUIEventOptions } from "@chativa/core";
import { ChativaElementHost } from "./internal/chativa-element-host";

/**
 * `detail` of the `genui-send-event` DOM event `<genui-message>` dispatches
 * when one of its components calls `sendEvent(...)`.
 */
export interface GenUISendEventDetail extends GenUIEventOptions {
  /** `messageId` of the dispatching `<genui-message>`. */
  msgId: string;
  eventType: string;
  payload: unknown;
  /** Stream-local id of the component that sent the event, when known. */
  sourceId?: number;
}

/**
 * Angular wrapper for `<genui-message>` — renders a streaming Generative UI
 * message (text + registered GenUI components) outside of
 * `<chativa-chat-iva>`'s own message list, e.g. to embed a single AI reply in
 * a custom layout.
 *
 * Every input is written to the element as a DOM property, so `messageData`
 * reaches it as an object.
 */
@Component({
  selector: "chativa-genui-message",
  standalone: true,
  imports: [NgIf],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [":host { display: contents; }"],
  template: `<genui-message #el *ngIf="loaded"></genui-message>`,
})
export class GenUIMessageComponent extends ChativaElementHost {
  /** The streaming GenUI message payload (`GenUIStreamState`), as stored on the message. */
  @Input() set messageData(value: Record<string, unknown> | null | undefined) {
    this.bridge.setProperty("messageData", value ?? {});
  }
  @Input() set sender(value: "user" | "bot" | null | undefined) {
    this.bridge.setProperty("sender", value ?? "bot");
  }
  @Input() set messageId(value: string | null | undefined) {
    this.bridge.setProperty("messageId", value ?? "");
  }
  @Input() set timestamp(value: number | null | undefined) {
    this.bridge.setProperty("timestamp", value ?? 0);
  }
  @Input() set hideAvatar(value: boolean | "" | null | undefined) {
    this.bridge.setProperty("hideAvatar", value === "" || value === true);
  }
  @Input() set status(value: string | null | undefined) {
    this.bridge.setProperty("status", value ?? "sent");
  }
  /** Show developer diagnostics (e.g. the unknown-component fallback). Off by default. */
  @Input() set debug(value: boolean | "" | null | undefined) {
    this.bridge.setProperty("debug", value === "" || value === true);
  }

  /** A GenUI component inside this message called `sendEvent(...)`. */
  @Output() readonly genuiSendEvent = new EventEmitter<GenUISendEventDetail>();

  constructor() {
    super();
    this.forwardDomEvent("genui-send-event", this.genuiSendEvent);
  }
}
