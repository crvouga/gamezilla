import { assert } from '@gamezilla/shared/assert';
import {
  fmt,
  fail as fmtFail,
  warn as fmtWarn,
} from '../lib/fmt';
import type { CiPlatform } from './platform';

export class LocalPlatform implements CiPlatform {
  readonly enforceDeployRole = false;

  error(message: string): void {
    assert.ok(
      typeof message === 'string' && message.length > 0,
      'error: message must be non-empty'
    );
    fmtFail('ERROR', message);
  }

  warning(message: string): void {
    assert.ok(
      typeof message === 'string' && message.length > 0,
      'warning: message must be non-empty'
    );
    fmtWarn('WARNING', message);
  }

  notice(message: string): void {
    assert.ok(
      typeof message === 'string' && message.length > 0,
      'notice: message must be non-empty'
    );
    console.log(`  ${fmt.dim(message)}`);
  }

  startGroup(_title: string): void {
    assert.ok(
      typeof _title === 'string' && _title.length > 0,
      'startGroup: title must be non-empty'
    );
  }

  endGroup(): void {}

  appendJobSummary(markdown: string): void {
    assert.ok(
      typeof markdown === 'string' && markdown.length > 0,
      'appendJobSummary: markdown must be non-empty'
    );
    console.log(markdown);
  }
}
