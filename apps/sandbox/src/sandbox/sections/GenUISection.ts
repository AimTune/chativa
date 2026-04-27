import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { sectionStyles, triggerGenUI } from "../sandboxShared";

const GENUI_DEMOS: Array<{ label: string; command: string }> = [
  { label: "🌤️ Weather",      command: "weather"       },
  { label: "🔔 Alerts",       command: "alert"         },
  { label: "⚡ Quick Replies", command: "quick-replies" },
  { label: "📝 List",         command: "list"          },
  { label: "📊 Table",        command: "table"         },
  { label: "⭐ Rating",       command: "rating"        },
  { label: "📈 Progress",     command: "progress"      },
  { label: "📋 Appt. Form",   command: "form"          },
  { label: "📅 Date Picker",  command: "date-picker"   },
  { label: "📊 Chart",        command: "chart"         },
  { label: "🪜 Steps",        command: "steps"         },
  { label: "🖼️ Gallery",      command: "image-gallery" },
  { label: "✍️ Typewriter",   command: "typewriter"    },
  { label: "✨ GenUI Demo",   command: "genui"         },
];

@customElement("sandbox-genui-section")
export class GenUISection extends LitElement {
  static override styles = [sectionStyles];

  @state() private _open = true;

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Generative UI</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body">
          <div class="msg-grid">
            ${GENUI_DEMOS.map(({ label, command }) => html`
              <button class="msg-btn" type="button" @click=${() => triggerGenUI(command)}>${label}</button>
            `)}
          </div>
        </div>
      ` : nothing}
    `;
  }
}
