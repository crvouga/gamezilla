import { assert } from '@gamezilla/shared/assert';
import { appendFileSync } from 'node:fs';
import type { CiPlatform } from './platform';

export class GitHubActionsPlatform implements CiPlatform {
  readonly enforceDeployRole = true;

  error(message: string): void {
    assert.ok(
      typeof message === 'string' && message.length > 0,
      'error: message must be non-empty'
    );
    console.error(`::error::${message}`);
  }

  warning(message: string): void {
    assert.ok(
      typeof message === 'string' && message.length > 0,
      'warning: message must be non-empty'
    );
    console.error(`::warning::${message}`);
  }

  notice(message: string): void {
    assert.ok(
      typeof message === 'string' && message.length > 0,
      'notice: message must be non-empty'
    );
    console.log(`::notice::${message}`);
  }

  startGroup(title: string): void {
    assert.ok(
      typeof title === 'string' && title.length > 0,
      'startGroup: title must be non-empty'
    );
    console.log(`::group::${title}`);
  }

  endGroup(): void {
    console.log('::endgroup::');
  }

  appendJobSummary(markdown: string): void {
    assert.ok(
      typeof markdown === 'string' && markdown.length > 0,
      'appendJobSummary: markdown must be non-empty'
    );
    const summaryPath = process.env['GITHUB_STEP_SUMMARY'] ?? '';
    if (summaryPath === '') {
      this.notice('GITHUB_STEP_SUMMARY not set — skipping summary.');
      return;
    }
    try {
      appendFileSync(summaryPath, markdown, 'utf8');
      this.notice('Job summary appended.');
    } catch (e) {
      this.warning(
        `Could not write job summary to ${summaryPath}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}
