import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { assert } from '@pkgs/assert';
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

  setOutput(name: string, value: string): void {
    assert.ok(
      typeof name === 'string' && name.length > 0,
      'setOutput: name must be non-empty'
    );
    assert.ok(typeof value === 'string', 'setOutput: value must be a string');
    const outputPath = process.env['GITHUB_OUTPUT'] ?? '';
    if (outputPath === '') {
      this.notice(`GITHUB_OUTPUT not set — skipping output ${name}.`);
      return;
    }
    const delim = `ghout_${randomBytes(16).toString('hex')}`;
    try {
      appendFileSync(
        outputPath,
        `${name}<<${delim}\n${value}\n${delim}\n`,
        'utf8'
      );
    } catch (e) {
      this.warning(
        `Could not write GITHUB_OUTPUT (${name}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}
