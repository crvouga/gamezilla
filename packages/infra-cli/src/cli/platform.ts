import { appendFileSync } from 'node:fs';
import { assert } from '@gamezilla/shared/assert';
import { fmt, heading, ok, fail as fmtFail, warn as fmtWarn, info, stepDone } from './fmt';

export interface CiPlatform {
  error(message: string): void;
  warning(message: string): void;
  notice(message: string): void;
  startGroup(title: string): void;
  endGroup(): void;
  readonly enforceDeployRole: boolean;
  appendJobSummary(markdown: string): void;
}

export async function runStep<T>(
  platform: CiPlatform,
  label: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  platform.startGroup(label);
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = performance.now() - t0;
    stepDone(label, ms);
    return result;
  } catch (e) {
    const ms = performance.now() - t0;
    platform.error(`${label} — FAILED after ${fmt.red(`${Math.round(ms)}ms`)}`);
    throw e;
  } finally {
    platform.endGroup();
  }
}

export class LocalPlatform implements CiPlatform {
  readonly enforceDeployRole = false;

  error(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'error: message must be non-empty');
    fmtFail('ERROR', message);
  }

  warning(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'warning: message must be non-empty');
    fmtWarn('WARNING', message);
  }

  notice(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'notice: message must be non-empty');
    info('', message);
  }

  startGroup(title: string): void {
    assert.ok(typeof title === 'string' && title.length > 0, 'startGroup: title must be non-empty');
    heading(title);
  }

  endGroup(): void {}

  appendJobSummary(markdown: string): void {
    assert.ok(typeof markdown === 'string' && markdown.length > 0, 'appendJobSummary: markdown must be non-empty');
    console.log(markdown);
  }
}

export class GitHubActionsPlatform implements CiPlatform {
  readonly enforceDeployRole = true;

  error(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'error: message must be non-empty');
    console.error(`::error::${message}`);
  }

  warning(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'warning: message must be non-empty');
    console.error(`::warning::${message}`);
  }

  notice(message: string): void {
    assert.ok(typeof message === 'string' && message.length > 0, 'notice: message must be non-empty');
    console.log(`::notice::${message}`);
  }

  startGroup(title: string): void {
    assert.ok(typeof title === 'string' && title.length > 0, 'startGroup: title must be non-empty');
    console.log(`::group::${title}`);
  }

  endGroup(): void {
    console.log('::endgroup::');
  }

  appendJobSummary(markdown: string): void {
    assert.ok(typeof markdown === 'string' && markdown.length > 0, 'appendJobSummary: markdown must be non-empty');
    const summaryPath = process.env['GITHUB_STEP_SUMMARY'] ?? '';
    if (summaryPath === '') {
      this.notice('GITHUB_STEP_SUMMARY not set — skipping summary.');
      return;
    }
    try {
      appendFileSync(summaryPath, markdown, 'utf8');
      this.notice('Job summary appended.');
    } catch (e) {
      this.warning(`Could not write job summary to ${summaryPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
