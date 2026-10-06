// Runs the wrappers WITHOUT Zone.js (this file never imports zone.js, and
// Vitest isolates modules per file). Angular 16 — the version this library is
// built and tested against — predates `provideZonelessChangeDetection()`, so
// the app is bootstrapped on the no-op NgZone: nothing is patched and change
// detection only runs when it is explicitly requested. That is the strictest
// setting: under Angular 18+ zoneless, the `markForCheck()` calls the wrappers
// make after loading and after every output emission are what schedule the
// same `tick()` this test performs by hand.
import { describe, it, expect, afterAll } from "vitest";
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  NgZone,
  ɵNoopNgZone as NoopNgZone,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { EventBus, type IncomingMessage } from "@chativa/core";
import { ChatIvaComponent } from "../chat-iva.component";
import { ChatBotButtonComponent } from "../chat-bot-button.component";
import { makeFakeConnector, waitFor } from "./helpers";

@Component({
  selector: "zoneless-root",
  standalone: true,
  imports: [ChatIvaComponent, ChatBotButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <chativa-chat-iva [connector]="connector" (message)="last = $event.id" />
    <chativa-chat-bot-button />
    <p class="last">{{ last }}</p>
  `,
})
class ZonelessRootComponent {
  connector = makeFakeConnector("zoneless-connector");
  last = "";
}

let appRef: ApplicationRef | undefined;

afterAll(() => appRef?.destroy());

describe("zoneless (no Zone.js)", () => {
  it("bootstraps, renders the elements and delivers outputs without Zone.js", async () => {
    expect((globalThis as { Zone?: unknown }).Zone).toBeUndefined();
    document.body.innerHTML = "<zoneless-root></zoneless-root>";

    appRef = await bootstrapApplication(ZonelessRootComponent, {
      providers: [{ provide: NgZone, useValue: new NoopNgZone() }],
    });
    const root = document.querySelector("zoneless-root") as HTMLElement;

    await waitFor(() => {
      appRef!.tick();
      expect(root.querySelector("chat-iva")).not.toBeNull();
      expect(root.querySelector("chat-bot-button")).not.toBeNull();
    });

    EventBus.emit("message_received", { id: "z1", type: "text", data: {} } as IncomingMessage);
    appRef.tick();
    expect(root.querySelector(".last")?.textContent).toBe("z1");
  });
});
