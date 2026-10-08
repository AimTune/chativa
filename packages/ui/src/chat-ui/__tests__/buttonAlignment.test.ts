import { afterEach, describe, expect, it } from "vitest";
import { LitElement } from "lit";
import { chatStore, DEFAULT_THEME } from "@chativa/core";
import { ChatbotMixin } from "../../mixins/ChatbotMixin";
import { ButtonsMessage } from "../ButtonsMessage";

class AlignmentHost extends ChatbotMixin(LitElement) {}
customElements.define("alignment-test-host", AlignmentHost);

const originalTheme = chatStore.getState().theme;

afterEach(() => {
  document.querySelectorAll("alignment-test-host").forEach((host) => host.remove());
  chatStore.setState({ theme: originalTheme });
});

describe("menu button alignment in shadow DOM", () => {
  it("propagates configured alignment and updates it on theme changes", async () => {
    chatStore.setState({ theme: DEFAULT_THEME });
    chatStore.getState().setTheme({ buttonTextAlign: "left" });
    const host = new AlignmentHost();
    document.body.append(host);
    await host.updateComplete;
    expect(host.style.getPropertyValue("--chativa-button-text-align")).toBe("left");

    chatStore.getState().setTheme({ buttonTextAlign: "right" });
    await host.updateComplete;
    expect(host.style.getPropertyValue("--chativa-button-text-align")).toBe("right");

    // Clearing the theme option permits ancestor CSS overrides again.
    chatStore.setState({ theme: DEFAULT_THEME });
    await host.updateComplete;
    expect(host.style.getPropertyValue("--chativa-button-text-align")).toBe("");
  });

  it("propagates fixed width and restores automatic sizing", async () => {
    chatStore.setState({ theme: DEFAULT_THEME });
    const host = new AlignmentHost();
    document.body.append(host);
    chatStore.getState().setTheme({ buttonWidth: "280px" });
    await host.updateComplete;
    expect(host.style.getPropertyValue("--chativa-button-width")).toBe("280px");
    chatStore.getState().setTheme({ buttonWidth: "auto" });
    await host.updateComplete;
    expect(host.style.getPropertyValue("--chativa-button-width")).toBe("max-content");
    chatStore.setState({ theme: DEFAULT_THEME });
    await host.updateComplete;
    expect(host.style.getPropertyValue("--chativa-button-width")).toBe("");
  });

  it("uses the inherited variable with a centered fallback for menu labels", async () => {
    const buttons = new ButtonsMessage();
    buttons.messageData = { buttons: [{ label: "2. Fiyat, Teklif & Kampanyalar" }] };
    document.body.append(buttons);
    await buttons.updateComplete;
    const styles = Array.from(buttons.shadowRoot!.querySelectorAll("style"))
      .map((style) => style.textContent).join("\n");
    expect(styles).toContain("text-align: var(--chativa-button-text-align, center)");
    expect(buttons.shadowRoot!.querySelector(".action-btn")?.textContent).toContain("Kampanyalar");
    buttons.remove();
  });
});
