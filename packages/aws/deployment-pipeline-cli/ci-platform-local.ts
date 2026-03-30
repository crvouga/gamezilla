import assert from 'node:assert/strict';
import type { CiPlatform } from './ci-platform';

export class LocalPlatform implements CiPlatform {
  readonly enforceDeployRole = false;

  error(message: string): void {
    assert(typeof message === 'string' && message.length > 0);
    console.error(`[ERROR] ${message}`);
  }

  notice(message: string): void {
    assert(typeof message === 'string' && message.length > 0);
    console.log(`[NOTICE] ${message}`);
  }

  appendJobSummary(_markdown: string): void {
    this.notice('Job summary skipped (local, no CI).');
  }
}
