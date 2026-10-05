import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { i18next } from "@chativa/core";
import { GenUIForm } from "../GenUIForm";
import type { GenUIFormField } from "../GenUIForm";

const FIELDS: GenUIFormField[] = [
  { name: "name", label: "Full name", type: "text", placeholder: "Jane Doe" },
  { name: "email", label: "Email", type: "email", required: false, value: "jane@example.com" },
  { name: "plan", label: "Plan", type: "text", value: "pro", disabled: true },
];

/** Minimal stand-in for the scoped listener bus GenUIMessage injects. */
function makeBus() {
  const listeners = new Map<string, (payload: unknown) => void>();
  return {
    listenEvent: (type: string, cb: (payload: unknown) => void) => { listeners.set(type, cb); },
    emit: (type: string, payload: unknown) => listeners.get(type)?.(payload),
  };
}

async function mount(opts: { fields?: GenUIFormField[]; title?: string; buttonText?: string } = {}) {
  const el = new GenUIForm();
  const bus = makeBus();
  const sendEvent = vi.fn();
  el.sendEvent = sendEvent;
  el.listenEvent = bus.listenEvent;
  el.fields = opts.fields ?? FIELDS;
  if (opts.title) el.title = opts.title;
  if (opts.buttonText) el.buttonText = opts.buttonText;
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, bus, sendEvent, root: el.shadowRoot! };
}

function submit(el: GenUIForm) {
  const form = el.shadowRoot!.querySelector("form")!;
  const evt = new Event("submit", { cancelable: true });
  form.dispatchEvent(evt);
  return evt;
}

// In the widget, @chativa/ui initialises i18next before any GenUI renders.
// No GenUI resources are loaded here, so labels resolve to their defaultValue.
beforeAll(async () => {
  await i18next.init({ lng: "en", resources: {} });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GenUIForm", () => {
  it("is defined as a custom element", () => {
    expect(customElements.get("genui-form")).toBe(GenUIForm);
  });

  it("renders the title and one labelled input per field", async () => {
    const { root } = await mount({ title: "Subscribe" });

    expect(root.querySelector(".form-title")?.textContent).toBe("Subscribe");
    const inputs = root.querySelectorAll("input");
    expect(inputs).toHaveLength(3);

    const name = root.querySelector<HTMLInputElement>("#genui-field-name")!;
    expect(name.name).toBe("name");
    expect(name.type).toBe("text");
    expect(name.placeholder).toBe("Jane Doe");
    expect(root.querySelector('label[for="genui-field-name"]')?.textContent).toBe("Full name");
  });

  it("omits the title heading when no title is given", async () => {
    const { root } = await mount();
    expect(root.querySelector(".form-title")).toBeNull();
  });

  it("marks fields required unless required:false, and honours disabled + initial value", async () => {
    const { root } = await mount();
    const [name, email, plan] = Array.from(root.querySelectorAll("input"));

    expect(name!.required).toBe(true);
    expect(email!.required).toBe(false);
    expect(email!.value).toBe("jane@example.com");
    expect(plan!.disabled).toBe(true);
    expect(name!.disabled).toBe(false);
  });

  it("uses the i18n fallback submit label, or buttonText when provided", async () => {
    const { root } = await mount();
    expect(root.querySelector(".submit-btn")?.textContent?.trim()).toBe("Submit");

    document.body.innerHTML = "";
    const custom = await mount({ buttonText: "Sign me up" });
    expect(custom.root.querySelector(".submit-btn")?.textContent?.trim()).toBe("Sign me up");
  });

  it("collects the form data and emits form_submit through sendEvent", async () => {
    const { el, root, sendEvent } = await mount();
    root.querySelector<HTMLInputElement>("#genui-field-name")!.value = "Ada";

    const evt = submit(el);

    expect(evt.defaultPrevented).toBe(true);
    expect(sendEvent).toHaveBeenCalledOnce();
    // Disabled inputs are excluded by FormData, exactly like a native submit.
    expect(sendEvent).toHaveBeenCalledWith("form_submit", { name: "Ada", email: "jane@example.com" });
  });

  it("enters a processing state that disables inputs and ignores repeat submits", async () => {
    const { el, root, sendEvent } = await mount();

    submit(el);
    await el.updateComplete;

    const btn = root.querySelector<HTMLButtonElement>(".submit-btn")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent?.trim()).toBe("Processing…");
    root.querySelectorAll("input").forEach((input) => expect(input.disabled).toBe(true));

    submit(el);
    expect(sendEvent).toHaveBeenCalledOnce();
  });

  it("switches to the success card on form_success with the server message", async () => {
    const { el, bus, root } = await mount();
    submit(el);

    bus.emit("form_success", { message: "You're subscribed." });
    await el.updateComplete;

    expect(root.querySelector("form")).toBeNull();
    expect(root.querySelector(".success-title")?.textContent).toBe("Success");
    expect(root.querySelector(".success-message")?.textContent).toBe("You're subscribed.");
  });

  it("falls back to the default success message when the payload has none", async () => {
    const { el, bus, root } = await mount();
    bus.emit("form_success", {});
    await el.updateComplete;
    expect(root.querySelector(".success-message")?.textContent).toBe("Done!");
  });

  it("ignores submits after success", async () => {
    const { el, bus, sendEvent } = await mount();
    bus.emit("form_success", {});
    await el.updateComplete;

    // The form is gone from the DOM; call the handler directly to prove the guard.
    (el as unknown as { _onSubmit(e: Event): void })._onSubmit(
      new Event("submit", { cancelable: true }),
    );
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("shows the server error on form_error and lets the user resubmit", async () => {
    const { el, bus, root, sendEvent } = await mount();
    submit(el);

    bus.emit("form_error", { message: "Email already taken" });
    await el.updateComplete;

    expect(root.querySelector(".error-msg")?.textContent).toBe("Email already taken");
    expect(root.querySelector<HTMLButtonElement>(".submit-btn")!.disabled).toBe(false);

    // Resubmitting clears the previous error.
    submit(el);
    await el.updateComplete;
    expect(sendEvent).toHaveBeenCalledTimes(2);
    expect(root.querySelector(".error-msg")).toBeNull();
  });

  it("falls back to the default error message when the payload has none", async () => {
    const { el, bus, root } = await mount();
    bus.emit("form_error", {});
    await el.updateComplete;
    expect(root.querySelector(".error-msg")?.textContent).toBe("Something went wrong.");
  });

  it("does not throw when mounted standalone without the injected API", async () => {
    const el = new GenUIForm();
    el.fields = FIELDS;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(() => submit(el)).not.toThrow();
  });
});
