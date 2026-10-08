import "./zone-testbed";
import { describe, it, expect, afterEach, vi } from "vitest";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { GenUIMessageComponent, type GenUISendEventDetail } from "../genui-message.component";
import { waitFor } from "./helpers";

@Component({
  standalone: true,
  imports: [GenUIMessageComponent],
  template: `
    <chativa-genui-message
      [messageData]="data"
      messageId="msg-1"
      [timestamp]="42"
      hideAvatar
      (genuiSendEvent)="onSend($event)"
    />
  `,
})
class HostComponent {
  data: Record<string, unknown> = { chunks: [], streamingComplete: true };
  onSend = vi.fn<(detail: GenUISendEventDetail) => void>();
}

@Component({
  standalone: true,
  imports: [GenUIMessageComponent],
  template: `
    <chativa-genui-message
      [messageData]="data"
      [sender]="sender"
      [messageId]="messageId"
      [timestamp]="timestamp"
      [hideAvatar]="hideAvatar"
      [status]="status"
      [debug]="debug"
    />
  `,
})
class DefaultsHostComponent {
  data: Record<string, unknown> | null = null;
  sender: "user" | "bot" | null = null;
  messageId: string | null = null;
  timestamp: number | null = null;
  hideAvatar: boolean | null = null;
  status: string | null = null;
  debug: boolean | null = null;
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe("GenUIMessageComponent", () => {
  it("writes inputs as DOM properties (objects keep their identity)", async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    await waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("genui-message")).not.toBeNull();
    });
    const el = fixture.nativeElement.querySelector("genui-message") as HTMLElement &
      Record<string, unknown>;

    expect(el).toBeInstanceOf(customElements.get("genui-message")!);
    expect(el["messageData"]).toBe(fixture.componentInstance.data);
    expect(el["messageId"]).toBe("msg-1");
    expect(el["timestamp"]).toBe(42);
    expect(el["hideAvatar"]).toBe(true);
    // Properties, not attributes.
    expect(el.hasAttribute("messagedata")).toBe(false);

    const next = { chunks: [], streamingComplete: false };
    fixture.componentInstance.data = next;
    fixture.detectChanges();
    expect(el["messageData"]).toBe(next);
  });

  it("falls back to safe defaults for nullish inputs and honours explicit values", async () => {
    const fixture = TestBed.createComponent(DefaultsHostComponent);
    fixture.detectChanges();
    await waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("genui-message")).not.toBeNull();
    });
    const el = fixture.nativeElement.querySelector("genui-message") as HTMLElement &
      Record<string, unknown>;

    // Nullish inputs reach the element as the documented defaults, never null.
    expect(el["messageData"]).toEqual({});
    expect(el["sender"]).toBe("bot");
    expect(el["messageId"]).toBe("");
    expect(el["timestamp"]).toBe(0);
    expect(el["hideAvatar"]).toBe(false);
    expect(el["status"]).toBe("sent");
    expect(el["debug"]).toBe(false);

    const host = fixture.componentInstance;
    host.sender = "user";
    host.status = "read";
    host.hideAvatar = true;
    host.debug = true;
    fixture.detectChanges();
    expect(el["sender"]).toBe("user");
    expect(el["status"]).toBe("read");
    expect(el["hideAvatar"]).toBe(true);
    expect(el["debug"]).toBe(true);
  });

  it("forwards genui-send-event as the genuiSendEvent output and stops after destroy", async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("genui-message")).not.toBeNull();
    });
    const el = fixture.nativeElement.querySelector("genui-message") as HTMLElement;

    const detail: GenUISendEventDetail = {
      msgId: "msg-1",
      eventType: "form_submit",
      payload: { a: 1 },
      sourceId: 3,
    };
    el.dispatchEvent(new CustomEvent("genui-send-event", { detail, bubbles: true, composed: true }));
    expect(fixture.componentInstance.onSend).toHaveBeenCalledWith(detail);

    const onSend = fixture.componentInstance.onSend;
    fixture.destroy();
    el.dispatchEvent(new CustomEvent("genui-send-event", { detail }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
