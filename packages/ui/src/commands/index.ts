import i18next, { t } from "i18next";
import { SlashCommandRegistry } from "@chativa/core";
import type { CommandContext } from "@chativa/core";

/**
 * Per-locale strings for a slash command.
 */
export interface CommandTranslations {
  description?: string;
  /** Optional parameter hint, e.g. "[count]" or "<text>" */
  usage?: string;
}

/**
 * Config object passed to `registerCommand()`.
 *
 * @example
 * registerCommand({
 *   name: "help",
 *   translations: {
 *     en: { description: "Show available topics", usage: "[topic]" },
 *     tr: { description: "Konuları göster",        usage: "[konu]"  },
 *   },
 *   execute({ args }) {
 *     console.log("help", args);
 *   },
 * });
 */
export interface LocalizedCommandConfig {
  name: string;
  /**
   * Locale → translations map.
   * At minimum supply an "en" entry so there is always a fallback.
   */
  translations: Record<string, CommandTranslations>;
  execute(context: CommandContext): void;
}

/**
 * Register a slash command with inline per-locale translations.
 *
 * The helper:
 * 1. Injects the provided strings into i18next (namespace "translation")
 *    under the keys `commands.<name>.description` and `commands.<name>.usage`.
 * 2. Registers the command in `SlashCommandRegistry` with lazy description
 *    and usage getters so they are re-evaluated on every render (picks up
 *    language switches automatically).
 */
export function registerCommand(config: LocalizedCommandConfig): void {
  const { name, translations, execute } = config;

  // Inject translations into i18next for every supplied locale
  for (const [lng, strings] of Object.entries(translations)) {
    const resources: Record<string, string> = {};
    if (strings.description !== undefined) {
      resources[`commands.${name}.description`] = strings.description;
    }
    if (strings.usage !== undefined) {
      resources[`commands.${name}.usage`] = strings.usage;
    }
    if (Object.keys(resources).length > 0) {
      i18next.addResources(lng, "translation", resources);
    }
  }

  SlashCommandRegistry.register({
    name,
    description: () => t(`commands.${name}.description`),
    usage: () => {
      const val = t(`commands.${name}.usage`, { defaultValue: "" });
      return val;
    },
    execute,
  });
}
