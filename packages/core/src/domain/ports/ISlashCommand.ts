/**
 * ISlashCommand — Port definition for slash commands.
 * No external dependencies allowed in this file.
 */

export interface CommandContext {
  /** Everything typed after the command name (trimmed). */
  args: string;
}

export interface ISlashCommand {
  /** Command name without the leading slash, e.g. "clear". */
  readonly name: string;
  /**
   * Short description shown in the autocomplete popup.
   * Pass a function for lazy i18n evaluation at render time:
   *   `description: () => t("commands.clear.description")`
   */
  readonly description: string | (() => string);
  /**
   * Optional usage hint displayed next to the command name.
   * Shows accepted parameters, e.g. `"[count]"` or `"<text>"`.
   * Also supports lazy i18n: `() => t("commands.clear.usage")`
   */
  readonly usage?: string | (() => string);
  execute(context: CommandContext): void;
}

/** Resolve a description or usage value, calling it if it is a function. */
export function resolveText(value: string | (() => string) | undefined): string {
  if (value === undefined) return "";
  return typeof value === "function" ? value() : value;
}
