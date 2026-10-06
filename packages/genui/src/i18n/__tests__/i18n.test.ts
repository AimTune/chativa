import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { i18next } from "@chativa/core";
import "../index";
import { GenUIForm } from "../../components/GenUIForm";
import { GenUIRating } from "../../components/GenUIRating";
import { GenUIDatePicker } from "../../components/GenUIDatePicker";

/**
 * `i18n/index.ts` registers its EN/TR bundles lazily: importing it before
 * i18next is initialised (as here) must defer registration to the
 * "initialized" event.
 */
beforeAll(async () => {
  expect(i18next.isInitialized).toBeFalsy();
  await i18next.init({ lng: "en", resources: {} });
});

afterEach(async () => {
  document.body.innerHTML = "";
  await i18next.changeLanguage("en");
});

async function mount<T extends HTMLElement & { updateComplete: Promise<boolean> }>(el: T): Promise<ShadowRoot> {
  document.body.appendChild(el);
  await el.updateComplete;
  return el.shadowRoot!;
}

describe("GenUI i18n resources", () => {
  it("registers English and Turkish strings once i18next initialises", () => {
    expect(i18next.t("genui.form.submit", { lng: "en" })).toBe("Submit");
    expect(i18next.t("genui.form.submit", { lng: "tr" })).toBe("Gönder");
    expect(i18next.t("genui.datePicker.label", { lng: "tr" })).toBe("Tarih seçin");
  });

  it("interpolates the star count", () => {
    expect(i18next.t("genui.rating.starLabel", { lng: "en", count: 4 })).toBe("4 stars");
    expect(i18next.t("genui.rating.starLabel", { lng: "tr", count: 4 })).toBe("4 yıldız");
  });

  it("localises built-in component labels", async () => {
    await i18next.changeLanguage("tr");

    const form = await mount(new GenUIForm());
    expect(form.querySelector(".submit-btn")?.textContent?.trim()).toBe("Gönder");

    const rating = await mount(new GenUIRating());
    expect(rating.querySelector(".submit-btn")?.textContent).toBe("Gönder");
    expect(rating.querySelector(".stars")?.getAttribute("aria-label")).toBe("Yıldız puanı");

    const picker = await mount(new GenUIDatePicker());
    expect(picker.querySelector("label")?.textContent).toBe("Tarih seçin");
  });

  it("re-renders mounted components when the language changes", async () => {
    const el = new GenUIDatePicker();
    const root = await mount(el);
    expect(root.querySelector("label")?.textContent).toBe("Select date");

    await i18next.changeLanguage("tr");
    await el.updateComplete;
    expect(root.querySelector("label")?.textContent).toBe("Tarih seçin");
  });

  it("registers immediately when imported after i18next is already initialised", async () => {
    i18next.removeResourceBundle("tr", "translation");
    expect(i18next.exists("genui.form.submit", { lng: "tr" })).toBe(false);

    vi.resetModules();
    await import("../index");

    expect(i18next.t("genui.form.submit", { lng: "tr" })).toBe("Gönder");
  });
});
