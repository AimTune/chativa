# Configuration Reference

There are two configuration objects. Both are JSON-Schema-validated.

| Object | Set via | Schema | Source of truth |
|---|---|---|---|
| `ChativaSettings` | `window.chativaSettings` (before mount) | [`schemas/chativa-settings.schema.json`](../schemas/chativa-settings.schema.json) | `application/ChativaSettings.ts` |
| `ThemeConfig` | `chatStore.getState().setTheme(...)` (any time) | [`schemas/theme.schema.json`](../schemas/theme.schema.json) | `domain/value-objects/Theme.ts` |

`ChativaSettings.theme` is a deep partial of `ThemeConfig` — anything you pass is merged over `DEFAULT_THEME`.

> **Schema drift guard.** The `ThemeConfig` ↔ schema contract is enforced by `schema-drift.test.ts`. Any field added to the TypeScript type without a matching schema update fails CI. See [schemas/README.md](../schemas/README.md) and [AGENTS.md → Schema sync](../AGENTS.md#schema-sync-rule).

## ChativaSettings

```ts
interface ChativaSettings {
  connector?: string | IConnector;
  theme?: DeepPartial<ThemeConfig>;
  locale?: string;          // BCP-47, e.g. "tr"
  i18n?: Record<string, unknown>;
}
```

Set it **before** `<chat-iva>` is connected:

```html
<script>
  window.chativaSettings = {
    connector: "directline",
    theme: { colors: { primary: "#1B1464" } },
    locale: "tr",
    i18n: { all: { header: { title: "Sanal Asistan" } } },
  };
</script>
<script type="module" src="..."></script>
<chat-iva></chat-iva>
```

`applyGlobalSettings()` runs once per page; later mutations to `window.chativaSettings` are ignored.

### `i18n` shape — two formats

**Per-language** (recommended) — the `all` key applies to every language; other keys are locale codes:

```ts
i18n: {
  all: { header: { title: "Bot" } },
  tr:  { header: { title: "Botum" } },
}
```

**Flat** (backwards compatible) — applied to every registered language:

```ts
i18n: { header: { title: "Bot" } }
```

## ThemeConfig

Full reference (all fields, defaults, enums, and constraints) lives in the schema: **[`schemas/theme.schema.json`](../schemas/theme.schema.json)**. Highlights:

| Field | Type | Default | Notes |
|---|---|---|---|
| `colors.primary/secondary/background/text/border` | `string` | brand defaults | Any CSS color. |
| `position` | `bottom-right \| bottom-left \| top-right \| top-left` | `bottom-right` | Launcher corner. |
| `positionMargin` | `"1"` … `"5"` | `"2"` | Edge margin (~0.5rem per step). |
| `size` | `small \| medium \| large` | `medium` | Launcher button diameter (44/56/68 px). |
| `layout.width/height/maxWidth/maxHeight` | `string` | `360px / 520px / 100% / 100%` | Panel sizing. |
| `layout.horizontalSpace / verticalSpace` | `"1"` … `"5"` | `"2"` | Panel ↔ viewport / panel ↔ button gaps. |
| `windowMode` | `popup \| side-panel \| fullscreen \| inline` | `popup` | Presentation style. See [theming.md → Window modes](./theming.md#window-modes). |
| `allowFullscreen` | `boolean` | `true` | Show fullscreen toggle in the header. |
| `showMessageStatus` | `boolean` | `true` | Tick indicators on user messages. |
| `enableSearch` | `boolean` | `true` | Header search button. |
| `enableMultiConversation` | `boolean` | `false` | Conversation list view. Requires connector hooks. See [multi-conversation.md](./multi-conversation.md). |
| `enableFileUpload` | `boolean` | `true` | Attach button — also requires `connector.sendFile`. |
| `hideButtonOnOpen` | `boolean` | `false` | For slotted custom launchers. |
| `avatar.{bot,user,header,showBot,showUser}` | `string \| boolean` | defaults | Avatars. |
| `endOfConversationSurvey` | `object` | enabled | See [survey.md](./survey.md). |

## Setting at runtime

```ts
import { chatStore } from "@chativa/core";

chatStore.getState().setTheme({
  colors: { primary: "#0ea5e9" },
  windowMode: "side-panel",
  enableSearch: false,
});
```

`setTheme()` accepts `DeepPartial<ThemeConfig>` — only the keys you pass are overridden via `mergeTheme()`.

## Or use the fluent builder

```ts
import { ThemeBuilder } from "@chativa/core";

const theme = ThemeBuilder.create()
  .setPrimary("#0ea5e9")
  .setPosition("bottom-left")
  .setSize("large")
  .setLayout({ width: "400px", height: "600px" })
  .setShowMessageStatus(true)
  .build();

chatStore.getState().setTheme(theme);
```
