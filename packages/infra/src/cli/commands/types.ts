export type CommandGroup = 'lifecycle' | 'validation' | 'setup';

export interface Command {
  readonly id: string;
  readonly summary: string;
  readonly group?: CommandGroup;
  /** If true, interactive mode asks for confirmation before running. */
  readonly danger?: boolean;
  /** Shown as the select hint; defaults to summary in the interactive menu. */
  readonly hint?: string;
  /**
   * If true, the CLI acquires the global infra lock (PlanetScale-backed) before
   * `execute` and releases after. Inner commands invoked programmatically do not
   * pass through the CLI entry and therefore do not re-acquire.
   */
  readonly requiresLock?: boolean;
  execute(): void | Promise<void>;
}
