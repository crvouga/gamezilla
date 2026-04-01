/* eslint-disable expo/no-dynamic-env-var */
import { appendFileSync } from 'node:fs';
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

export class GitHubActionsPlatform implements CiPlatform {
  readonly enforceDeployRole = true;

  error(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'error: message must be non-empty');
    console.error(`::error::${message}`);
  }

  notice(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'notice: message must be non-empty');
    console.log(`::notice::${message}`);
  }

  appendJobSummary(markdown: string): void {
    assert.ok(typeof markdown === 'string' && markdown.length > 0, 'appendJobSummary: markdown must be non-empty');
    const summaryPath = process.env['GITHUB_STEP_SUMMARY'] ?? '';
    if (summaryPath === '') {
      this.notice('GITHUB_STEP_SUMMARY not set — skipping summary.');
      return;
    }
    appendFileSync(summaryPath, markdown, 'utf8');
    this.notice('Job summary appended.');
  }
}
