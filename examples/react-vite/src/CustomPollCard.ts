import { GenUIRegistry } from "@chativa/genui";

/**
 * A second, distinct custom GenUI component — interactive rather than
 * display-only like `CustomWeatherCard`. Demonstrates `sendEvent`, which
 * `<genui-message>` injects onto every GenUI component instance right after
 * constructing it (before props are assigned): calling it dispatches a
 * `genui-send-event` DOM event that bubbles up through `<ChatIva>` to
 * `ChatEngine.receiveComponentEvent()` → `connector.receiveComponentEvent()`
 * — the same path a real backend-driven form submit or button click uses.
 *
 * Also plain `HTMLElement` — see `CustomWeatherCard.ts` for why.
 */

const STYLE = `
  :host { display: block; }
  .card {
    max-width: 280px;
    padding: 16px 18px;
    border-radius: 14px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .question { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
  .options { display: flex; flex-direction: column; gap: 8px; }
  button.option {
    text-align: left;
    border: 1px solid #c7d2fe;
    border-radius: 8px;
    padding: 8px 12px;
    background: #eef2ff;
    color: #4338ca;
    font-size: 0.875rem;
    cursor: pointer;
  }
  button.option:hover { background: #e0e7ff; }
  .voted { font-size: 0.875rem; color: #4338ca; }
  .voted strong { color: #0f172a; }
`;

/** Props assigned onto the instance — same shape as the `AIChunkUI.props` sent for this component. */
interface PollProps {
  question: string;
  options: string[];
}

const DEFAULTS: PollProps = { question: "", options: [] };

export class CustomPollCard extends HTMLElement {
  #state: PollProps = { ...DEFAULTS };
  #votedOption: string | null = null;
  #root: ShadowRoot;

  /** Injected by `<genui-message>` right after construction — see the file doc comment. */
  sendEvent?: (type: string, payload: unknown) => void;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });

    for (const key of Object.keys(DEFAULTS) as (keyof PollProps)[]) {
      Object.defineProperty(this, key, {
        get: () => this.#state[key],
        set: (value) => {
          (this.#state[key] as unknown) = value;
          this.#render();
        },
      });
    }
  }

  connectedCallback() {
    this.#render();
  }

  #vote(option: string) {
    if (this.#votedOption) return;
    this.#votedOption = option;
    this.sendEvent?.("poll_vote", { option });
    this.#render();
  }

  #render() {
    const { question, options } = this.#state;

    if (this.#votedOption) {
      this.#root.innerHTML = `<style>${STYLE}</style><div class="card"><div class="voted">Thanks for voting: <strong></strong></div></div>`;
      this.#root.querySelector("strong")!.textContent = this.#votedOption;
      return;
    }

    this.#root.innerHTML = `
      <style>${STYLE}</style>
      <div class="card">
        <div class="question"></div>
        <div class="options"></div>
      </div>
    `;
    this.#root.querySelector(".question")!.textContent = question;

    const optionsEl = this.#root.querySelector(".options")!;
    for (const option of options) {
      const button = document.createElement("button");
      button.className = "option";
      button.type = "button";
      button.textContent = option;
      button.addEventListener("click", () => this.#vote(option));
      optionsEl.appendChild(button);
    }
  }
}

if (!customElements.get("demo-poll-card")) {
  customElements.define("demo-poll-card", CustomPollCard);
}

GenUIRegistry.register("poll", CustomPollCard);
