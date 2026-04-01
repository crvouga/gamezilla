export interface SetupCommand {
  readonly id: string;
  readonly summary: string;
  match(argv: string[]): boolean;
  execute(argv: string[]): void | Promise<void>;
}

export abstract class BaseSetupCommand implements SetupCommand {
  abstract readonly id: string;
  abstract readonly summary: string;

  match(argv: string[]): boolean {
    return argv[2] === this.id;
  }

  abstract execute(argv: string[]): void | Promise<void>;
}
