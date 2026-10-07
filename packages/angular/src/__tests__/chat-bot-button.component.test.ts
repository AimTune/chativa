import "./zone-testbed";
import { describe, it, expect, afterEach } from "vitest";
import { PLATFORM_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ChatBotButtonComponent } from "../chat-bot-button.component";
import { loadChativaUi } from "../internal/load-chativa-ui";
import { waitFor } from "./helpers";

afterEach(() => {
  TestBed.resetTestingModule();
});

describe("ChatBotButtonComponent", () => {
  it("exposes the underlying element: null before load, the <chat-bot-button> instance after", async () => {
    const fixture = TestBed.createComponent(ChatBotButtonComponent);
    const component = fixture.componentRef.instance;
    fixture.detectChanges();

    // The UI package loads lazily — until then there is no element.
    expect(component.element).toBeNull();

    await waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("chat-bot-button")).not.toBeNull();
    });
    const el = fixture.nativeElement.querySelector("chat-bot-button") as HTMLElement;
    expect(el).toBeInstanceOf(customElements.get("chat-bot-button")!);
    expect(component.element).toBe(el);
  });

  it("never flips to loaded when destroyed before @chativa/ui finishes loading", async () => {
    const fixture = TestBed.createComponent(ChatBotButtonComponent);
    const component = fixture.componentRef.instance;
    fixture.detectChanges(); // ngOnInit kicks off the lazy load
    fixture.destroy();

    await loadChativaUi();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(component.loaded).toBe(false);
    expect(component.element).toBeNull();
  });

  it("never loads @chativa/ui on a server platform (SSR safety)", async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: "server" }],
    });
    const fixture = TestBed.createComponent(ChatBotButtonComponent);
    const component = fixture.componentRef.instance;
    fixture.detectChanges();

    await loadChativaUi(); // give any (wrongly started) load time to settle
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(component.loaded).toBe(false);
    expect(fixture.nativeElement.querySelector("chat-bot-button")).toBeNull();
  });
});
