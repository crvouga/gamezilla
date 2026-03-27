import assert from 'node:assert/strict';

export interface CiCommand {
  readonly id: string;
  readonly summary: string;
  match(argv: string[]): boolean;
  execute(argv: string[]): void | Promise<void>;
}

export abstract class BaseCiCommand implements CiCommand {
  abstract readonly id: string;
  abstract readonly summary: string;

  match(argv: string[]): boolean {
    assert(Array.isArray(argv));
    assert(typeof this.id === 'string' && this.id.length > 0);
    assert(
      typeof this.summary === 'string' && this.summary.length > 0,
      'CiCommand.summary must be a non-empty string'
    );
    return argv[2] === this.id;
  }

  abstract execute(argv: string[]): void | Promise<void>;
}
