export interface Command {
  readonly id: string;
  readonly summary: string;
  execute(): void | Promise<void>;
}
