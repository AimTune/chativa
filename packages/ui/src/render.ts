import type { ChativaSettings } from "@chativa/core";

export interface RenderOptions extends ChativaSettings {
    /**
     * Floating button configuration.
     * - `false`  → no button
     * - `true`   → default animated button (default)
     * - `string` → treated as innerHTML for the button (e.g. an `<img>` tag)
     * - `Node`   → appended as a child of `<chat-bot-button>` (slot content)
     */
    button?: boolean | string | Node;
}

/**
 * Mount the Chativa chat widget into a container element.
 *
 * ```js
 * Chativa.render(document.body, {
 *     connector: myConnector,
 *     theme:  { colors: { primary: "#1B1464" } },
 *     i18n:   { header: { title: "Hey, DO!" } },
 *     button: '<img src="bot.gif" alt="Chat" style="width:96px;height:62px" />',
 * });
 * ```
 */
export function render(
    container: HTMLElement,
    options: RenderOptions = {},
): { widget: HTMLElement; button: HTMLElement | null } {
    const { button: buttonOpt = true, ...settings } = options;

    // Apply settings so applyGlobalSettings() picks them up in connectedCallback
    window.chativaSettings = { ...window.chativaSettings, ...settings };

    // Push theme colors as CSS custom properties onto the container so that
    // any light-DOM styles (outside shadow roots) can use var(--chativa-*).
    if (settings.theme?.colors) {
        const c = settings.theme.colors;
        const map: Record<string, string | undefined> = {
            "--chativa-primary-color": c.primary,
            "--chativa-secondary-color": c.secondary,
            "--chativa-background-color": c.background,
            "--chativa-text-color": c.text,
            "--chativa-border-color": c.border,
        };
        for (const [prop, value] of Object.entries(map)) {
            if (value) container.style.setProperty(prop, value);
        }
    }

    // Create button
    let btn: HTMLElement | null = null;
    if (buttonOpt !== false) {
        btn = document.createElement("chat-bot-button");
        if (typeof buttonOpt === "string") {
            btn.innerHTML = buttonOpt;
        } else if (buttonOpt instanceof Node) {
            btn.appendChild(buttonOpt);
        }
        container.appendChild(btn);
    }

    // Create widget
    const widget = document.createElement("chat-iva");
    container.appendChild(widget);

    return { widget, button: btn };
}
