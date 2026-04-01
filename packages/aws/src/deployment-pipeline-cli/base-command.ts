import { assert } from '@gamezilla/shared/assert';
import { CiPlatform } from './ci-platform';

export interface PipelineCommand {
  readonly id: string;
  readonly summary: string;
  match(argv: string[]): boolean;
  execute(argv: string[]): void | Promise<void>;
}

export abstract class BasePipelineCommand implements PipelineCommand {
  abstract readonly id: string;
  abstract readonly summary: string;

  constructor(protected readonly platform: CiPlatform) {}

  match(argv: string[]): boolean {
    assert.array(argv, 'match: argv must be an array');
    assert.ok(
      typeof this.id === 'string' && this.id.length > 0,
      'match: id must be non-empty'
    );
    assert.ok(
      typeof this.summary === 'string' && this.summary.length > 0,
      'PipelineCommand.summary must be a non-empty string'
    );
    return argv[2] === this.id;
  }

  abstract execute(argv: string[]): void | Promise<void>;
}
