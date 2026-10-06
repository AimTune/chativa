import type { ReactiveController, ReactiveControllerHost } from "lit";
import { i18next } from "@chativa/core";

/**
 * Base language subtags that are written right-to-left.
 *
 * Matching is done on the base subtag only, so regional variants such as
 * `ar-EG`, `he-IL` or `fa_IR` are covered by their base entry.
 */
export const RTL_LANGUAGES: readonly string[] = Object.freeze(["ar", "he", "fa", "ur"]);

/** Writing direction of a language, as used by the HTML `dir` attribute. */
export type TextDirection = "ltr" | "rtl";

/**
 * `true` when `lang` is written right-to-left.
 *
 * Only the base subtag is compared (case-insensitive), so `"ar"`, `"AR"`,
 * `"ar-EG"` and `"ar_EG"` all return `true`. Empty / missing input → `false`.
 */
export function isRtlLanguage(lang: string | null | undefined): boolean {
    if (!lang) return false;
    const base = lang.trim().toLowerCase().split(/[-_]/)[0];
    return RTL_LANGUAGES.includes(base);
}

/** `"rtl"` for right-to-left languages, `"ltr"` for everything else. */
export function getLanguageDirection(lang: string | null | undefined): TextDirection {
    return isRtlLanguage(lang) ? "rtl" : "ltr";
}

type DirHost = ReactiveControllerHost & HTMLElement;

/**
 * Keeps the host element's `dir` attribute in sync with the active i18next
 * language, so every shadow root underneath inherits the right direction and
 * logical CSS properties / `:dir()` selectors resolve correctly.
 *
 * An author-set `dir` always wins: if the attribute is present before the
 * controller first writes it, or is set later by anything other than the
 * controller (markup, `el.dir = "rtl"`, `setAttribute`) — even to the value
 * the controller would have chosen — the controller stops touching it.
 * Removing the attribute hands control back to the active language.
 *
 * Attached to every independently mounted root: `<chat-iva>`,
 * `<chat-bot-button>` and `<agent-panel>`.
 */
export class DirectionController implements ReactiveController {
    private readonly _host: DirHost;
    /** Value the controller last wrote (`null` before the first write). */
    private _written: string | null = null;
    /** Our own writes, oldest first, not yet seen by the observer. */
    private readonly _pendingWrites: string[] = [];
    /** True while the page author owns the attribute. */
    private _authorOwned = false;
    private _observer: MutationObserver | null = null;
    private _initialised = false;

    constructor(host: DirHost) {
        this._host = host;
        host.addController(this);
    }

    /** `true` when the host's current `dir` was set by the page author. */
    get isAuthorSet(): boolean {
        return this._authorOwned;
    }

    hostConnected(): void {
        const current = this._host.getAttribute("dir");
        if (!this._initialised) {
            this._initialised = true;
            // Present before we ever wrote it → markup / host code set it.
            this._authorOwned = current !== null;
        } else if (!this._authorOwned && current !== null && current !== this._written) {
            // Changed while disconnected (no observer was watching).
            this._authorOwned = true;
        } else if (current === null) {
            this._authorOwned = false;
        }
        i18next.on("languageChanged", this._sync);
        if (typeof MutationObserver !== "undefined") {
            this._observer = new MutationObserver(this._onMutations);
            this._observer.observe(this._host, {
                attributes: true,
                attributeFilter: ["dir"],
                attributeOldValue: true,
            });
        }
        this._sync();
    }

    hostDisconnected(): void {
        i18next.off("languageChanged", this._sync);
        if (this._observer) {
            // Flush queued records so an author write just before removal counts.
            this._onMutations(this._observer.takeRecords());
            this._observer.disconnect();
            this._observer = null;
        }
        this._pendingWrites.length = 0;
    }

    private _onMutations = (records: MutationRecord[]): void => {
        if (records.length === 0) return;
        let released = false;
        records.forEach((record, i) => {
            // A record only carries the old value; the new one is the next
            // record's old value, or the live attribute for the last record.
            const next = records[i + 1];
            const newValue = next ? next.oldValue : this._host.getAttribute("dir");
            if (
                this._pendingWrites.length > 0 &&
                this._pendingWrites[0] === newValue &&
                record.oldValue !== newValue
            ) {
                this._pendingWrites.shift();
                return;
            }
            this._authorOwned = newValue !== null;
            released = newValue === null;
        });
        if (released) this._sync();
    };

    private _sync = (): void => {
        if (this._authorOwned) return;
        const current = this._host.getAttribute("dir");
        if (this._written !== null && current !== null && current !== this._written) {
            // Someone else wrote it in this same task, before the observer ran.
            this._authorOwned = true;
            return;
        }
        const dir = getLanguageDirection(i18next.language);
        this._written = dir;
        if (current === dir) return;
        if (this._observer) this._pendingWrites.push(dir);
        this._host.setAttribute("dir", dir);
    };
}
