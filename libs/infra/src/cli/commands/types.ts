export type CommandGroup = 'ci' | 'lifecycle' | 'phase' | 'setup';

export interface Command {
  readonly id: string;
  readonly summary: string;
  readonly group?: CommandGroup;
  /** Tagged as destructive in help output. */
  readonly danger?: boolean;
  /**
   * If true, the CLI acquires the global infra lock (Postgres-backed) before
   * `execute` and releases after. Inner commands invoked programmatically do not
   * pass through the CLI entry and therefore do not re-acquire.
   */
  readonly requiresLock?: boolean;
  execute(): void | Promise<void>;
}
