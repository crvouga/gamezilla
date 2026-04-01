import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export class LocalPlatform implements CiPlatform {
  readonly enforceDeployRole = false;

  error(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'error: message must be non-empty');
    console.error(`[ERROR] ${message}`);
  }

  notice(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'notice: message must be non-empty');
    console.log(`[NOTICE] ${message}`);
  }

  appendJobSummary(_markdown: string): void {
    this.notice('Job summary skipped (local, no CI).');
  }
}
