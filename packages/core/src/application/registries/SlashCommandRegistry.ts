import type { ISlashCommand, CommandContext } from "../../domain/ports/ISlashCommand";

const _commands = new Map<string, ISlashCommand>();

/**
 * Registry for slash commands.
 * Commands are registered by extensions or app code and executed from ChatInput.
 * Built-in commands (e.g. /clear) are registered at the UI layer so they can
 * use the UI's i18n functions for translated descriptions.
 */
export const SlashCommandRegistry = {
  register(command: ISlashCommand): void {
    _commands.set(command.name, command);
  },

  unregister(name: string): void {
    _commands.delete(name);
  },

  get(name: string): ISlashCommand | undefined {
    return _commands.get(name);
  },

  list(): ISlashCommand[] {
    return Array.from(_commands.values());
  },

  execute(name: string, args: string): boolean {
    const cmd = _commands.get(name);
    if (!cmd) return false;
    const context: CommandContext = { args };
    cmd.execute(context);
    return true;
  },

  has(name: string): boolean {
    return _commands.has(name);
  },

  /** Reset all commands — for use in tests only. */
  clear(): void {
    _commands.clear();
  },
};
