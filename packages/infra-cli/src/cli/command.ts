export type CommandGroup = 'main' | 'domains' | 'ci';

export interface Command {
  readonly id: string;
  readonly summary: string;
  readonly group: CommandGroup;
  execute(): void | Promise<void>;
}
