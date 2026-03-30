/* eslint-disable expo/no-dynamic-env-var */
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import type { CiPlatform } from './ci-platform';

export class GitHubActionsPlatform implements CiPlatform {
  readonly enforceDeployRole = true;

  error(message: string): void {
    assert(typeof message === 'string' && message.length > 0);
    console.error(`::error::${message}`);
  }

  notice(message: string): void {
    assert(typeof message === 'string' && message.length > 0);
    console.log(`::notice::${message}`);
  }

  appendJobSummary(markdown: string): void {
    assert(typeof markdown === 'string' && markdown.length > 0);
    const summaryPath = process.env['GITHUB_STEP_SUMMARY'] ?? '';
    if (summaryPath === '') {
      this.notice('GITHUB_STEP_SUMMARY not set — skipping summary.');
      return;
    }
    appendFileSync(summaryPath, markdown, 'utf8');
    this.notice('Job summary appended.');
  }
}
