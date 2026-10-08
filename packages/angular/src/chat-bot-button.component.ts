import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from "@angular/core";
import { NgIf } from "@angular/common";
import { ChativaElementHost } from "./internal/chativa-element-host";

/**
 * Angular wrapper for `<chat-bot-button>` — the floating launcher that
 * toggles the shared `chatStore` open state. Project content into it to
 * replace the default gradient circle with a fully custom launcher:
 *
 * @example
 * ```html
 * <chativa-chat-bot-button>
 *   <img src="/assets/bot.png" alt="Chat" />
 * </chativa-chat-bot-button>
 * ```
 */
@Component({
  selector: "chativa-chat-bot-button",
  standalone: true,
  imports: [NgIf],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [":host { display: contents; }"],
  template: `<chat-bot-button #el *ngIf="loaded"><ng-content></ng-content></chat-bot-button>`,
})
export class ChatBotButtonComponent extends ChativaElementHost {}
