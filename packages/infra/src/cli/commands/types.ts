export type CommandGroup = 'lifecycle' | 'validation' | 'setup';

export interface Command {
  readonly id: string;
  readonly summary: string;
  readonly group?: CommandGroup;
  /** If true, interactive mode asks for confirmation before running. */
  readonly danger?: boolean;
  /** Shown as the select hint; defaults to summary in the interactive menu. */
  readonly hint?: string;
  execute(): void | Promise<void>;
}
