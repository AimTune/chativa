import { describe, it, expect, vi, afterEach } from "vitest";
import type { LitElement } from "lit";
import { GenUIAlert } from "../GenUIAlert";
import { GenUICard } from "../GenUICard";
import { GenUIList } from "../GenUIList";
import { GenUIProgress } from "../GenUIProgress";
import { GenUIQuickReplies } from "../GenUIQuickReplies";
import { GenUITable } from "../GenUITable";
import { GenUISteps } from "../GenUISteps";

async function mount<T extends LitElement>(el: T, props: Partial<T> = {}): Promise<ShadowRoot> {
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el.shadowRoot!;
}

const text = (root: ParentNode, sel: string) => root.querySelector(sel)?.textContent?.trim();

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GenUIAlert", () => {
  it("renders title, message and the variant's default icon with role=alert", async () => {
    const root = await mount(new GenUIAlert(), { variant: "warning", title: "Heads up", message: "Expiring soon" });
    const alert = root.querySelector(".alert")!;

    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.classList.contains("alert--warning")).toBe(true);
    expect(text(root, ".title")).toBe("Heads up");
    expect(text(root, ".message")).toBe("Expiring soon");
    expect(text(root, ".icon")).toBe("⚠️");
  });

  it.each([
    ["info", "ℹ️"],
    ["success", "✅"],
    ["error", "❌"],
  ] as const)("uses the default %s icon", async (variant, icon) => {
    const root = await mount(new GenUIAlert(), { variant });
    expect(text(root, ".icon")).toBe(icon);
  });

  it("falls back to the info icon for an unknown variant and honours a custom icon", async () => {
    const unknown = await mount(new GenUIAlert(), { variant: "bogus" as never });
    expect(text(unknown, ".icon")).toBe("ℹ️");

    const custom = await mount(new GenUIAlert(), { icon: "🚀" });
    expect(text(custom, ".icon")).toBe("🚀");
  });

  it("omits empty title and message", async () => {
    const root = await mount(new GenUIAlert());
    expect(root.querySelector(".title")).toBeNull();
    expect(root.querySelector(".message")).toBeNull();
  });
});

describe("GenUICard", () => {
  it("renders image, title and description", async () => {
    const root = await mount(new GenUICard(), {
      title: "Pro Plan",
      description: "All features included",
      image: "https://example.com/pro.png",
    });
    const img = root.querySelector<HTMLImageElement>(".card-image")!;
    expect(img.getAttribute("src")).toBe("https://example.com/pro.png");
    expect(img.alt).toBe("Pro Plan");
    expect(text(root, ".card-title")).toBe("Pro Plan");
    expect(text(root, ".card-description")).toBe("All features included");
  });

  it("renders nothing optional when props are empty", async () => {
    const root = await mount(new GenUICard());
    expect(root.querySelector(".card-image")).toBeNull();
    expect(root.querySelector(".card-title")).toBeNull();
    expect(root.querySelector(".card-description")).toBeNull();
    expect(root.querySelector(".card-actions")).toBeNull();
  });

  it("dispatches a bubbling, composed chat-action with the action value on click", async () => {
    const el = new GenUICard();
    const root = await mount(el, {
      actions: [
        { label: "Select", value: "select_pro" },
        { label: "Compare", value: "compare" },
      ],
    });
    const spy = vi.fn();
    document.body.addEventListener("chat-action", spy as EventListener);

    const buttons = root.querySelectorAll<HTMLButtonElement>(".action-btn");
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["Select", "Compare"]);
    buttons[1]!.click();

    expect(spy).toHaveBeenCalledOnce();
    const evt = spy.mock.calls[0]![0] as CustomEvent<string>;
    expect(evt.detail).toBe("compare");
    expect(evt.bubbles).toBe(true);
    expect(evt.composed).toBe(true);
    document.body.removeEventListener("chat-action", spy as EventListener);
  });
});

describe("GenUIList", () => {
  const items = [
    { text: "Real-time sync", icon: "⚡" },
    { text: "Encryption", secondary: "AES-256" },
  ];

  it("renders an unordered list with custom icons, bullet fallback and secondary text", async () => {
    const root = await mount(new GenUIList(), { title: "Key features", items });

    expect(text(root, ".list-title")).toBe("Key features");
    expect(root.querySelector("ol")).toBeNull();
    const lis = root.querySelectorAll("ul > li");
    expect(lis).toHaveLength(2);
    expect(text(lis[0]!, ".item-icon")).toBe("⚡");
    expect(text(lis[1]!, ".item-icon")).toBe("•");
    expect(text(lis[1]!, ".item-secondary")).toBe("AES-256");
    expect(lis[0]!.querySelector(".item-secondary")).toBeNull();
  });

  it("renders a numbered <ol> when ordered", async () => {
    const root = await mount(new GenUIList(), { ordered: true, items });
    expect(root.querySelector("ul")).toBeNull();
    const numbers = Array.from(root.querySelectorAll(".item-number")).map((n) => n.textContent);
    expect(numbers).toEqual(["1.", "2."]);
    expect(root.querySelector(".item-icon")).toBeNull();
    expect(root.querySelector(".list-title")).toBeNull();
  });
});

describe("GenUIProgress", () => {
  it("renders label, value, caption and an accessible progressbar", async () => {
    const root = await mount(new GenUIProgress(), {
      label: "Order processing",
      value: 65,
      caption: "3 of 5 steps",
      variant: "success",
    });
    const bar = root.querySelector('[role="progressbar"]')!;

    expect(text(root, ".progress-label")).toBe("Order processing");
    expect(text(root, ".progress-value")).toBe("65%");
    expect(text(root, ".progress-caption")).toBe("3 of 5 steps");
    expect(bar.getAttribute("aria-valuenow")).toBe("65");
    expect(root.querySelector(".bar")!.classList.contains("bar--success")).toBe(true);
  });

  it.each([
    [150, "100"],
    [-20, "0"],
  ])("clamps %s to %s", async (value, expected) => {
    const root = await mount(new GenUIProgress(), { value });
    expect(root.querySelector('[role="progressbar"]')!.getAttribute("aria-valuenow")).toBe(expected);
    expect(root.querySelector(".progress-label")).toBeNull();
    expect(root.querySelector(".progress-caption")).toBeNull();
  });
});

describe("GenUIQuickReplies", () => {
  const items = [
    { label: "Pricing", value: "show_pricing" },
    { label: "Contact", value: "contact" },
  ];

  it("renders the label and one button per item", async () => {
    const root = await mount(new GenUIQuickReplies(), { label: "Choose:", items });
    expect(text(root, ".label")).toBe("Choose:");
    expect(Array.from(root.querySelectorAll(".reply-btn")).map((b) => b.textContent)).toEqual([
      "Pricing",
      "Contact",
    ]);
  });

  it("omits the label when empty", async () => {
    const root = await mount(new GenUIQuickReplies(), { items });
    expect(root.querySelector(".label")).toBeNull();
  });

  it("dispatches chat-action once, marks the choice and disables the row", async () => {
    const el = new GenUIQuickReplies();
    const root = await mount(el, { items });
    const spy = vi.fn();
    el.addEventListener("chat-action", spy as EventListener);

    const buttons = () => Array.from(root.querySelectorAll<HTMLButtonElement>(".reply-btn"));
    buttons()[0]!.click();
    await el.updateComplete;

    expect(spy).toHaveBeenCalledOnce();
    expect((spy.mock.calls[0]![0] as CustomEvent).detail).toBe("show_pricing");
    expect(buttons()[0]!.classList.contains("reply-btn--selected")).toBe(true);
    buttons().forEach((b) => expect(b.disabled).toBe(true));

    // A second selection (e.g. programmatic) is ignored.
    (el as unknown as { _onSelect(i: { label: string; value: string }): void })._onSelect(items[1]!);
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("GenUITable", () => {
  it("renders a header row and body cells", async () => {
    const root = await mount(new GenUITable(), {
      title: "Pricing",
      columns: ["Plan", "Price"],
      rows: [["Free", 0], ["Pro", 12]],
    });

    expect(text(root, ".table-title")).toBe("Pricing");
    expect(Array.from(root.querySelectorAll("th")).map((th) => th.textContent)).toEqual(["Plan", "Price"]);
    const cells = Array.from(root.querySelectorAll("tbody td")).map((td) => td.textContent?.trim());
    expect(cells).toEqual(["Free", "0", "Pro", "12"]);
    // With columns present it is not a key-value table.
    expect(root.querySelector(".kv-key")).toBeNull();
  });

  it("treats header-less two-column rows as a key-value table", async () => {
    const root = await mount(new GenUITable(), { rows: [["Name", "Jane"], ["Email", "jane@x.com"]] });
    expect(root.querySelector("thead")).toBeNull();
    expect(root.querySelector(".table-title")).toBeNull();
    const keys = Array.from(root.querySelectorAll(".kv-key")).map((td) => td.textContent?.trim());
    expect(keys).toEqual(["Name", "Email"]);
  });

  it("does not use key-value styling when a row is not two cells wide", async () => {
    const root = await mount(new GenUITable(), { rows: [["a", "b", "c"]] });
    expect(root.querySelector(".kv-key")).toBeNull();
  });
});

describe("GenUISteps rendering", () => {
  it("renders each step with its status icon, label and optional description", async () => {
    const root = await mount(new GenUISteps(), {
      steps: [
        { label: "Placed", status: "done" },
        { label: "Preparing", status: "active", description: "In the kitchen" },
        { label: "Delivery", status: "pending" },
      ],
    });
    const steps = root.querySelectorAll(".step");
    expect(steps).toHaveLength(3);
    expect(steps[0]!.querySelector(".step-icon--done svg")).not.toBeNull();
    expect(steps[1]!.querySelector(".step-icon--active")).not.toBeNull();
    expect(text(steps[1]!, ".step-description")).toBe("In the kitchen");
    expect(steps[2]!.querySelector(".step-label--pending")).not.toBeNull();
    expect(steps[0]!.querySelector(".step-description")).toBeNull();
  });

  it("renders nothing for an empty or missing steps array", async () => {
    const root = await mount(new GenUISteps());
    expect(root.querySelector(".steps-container")).toBeNull();
  });
});
