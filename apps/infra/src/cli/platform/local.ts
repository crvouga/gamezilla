import { assert } from '@gamezilla/lib/assert';
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

  setOutput(name: string, value: string): void {
    assert.ok(
      typeof name === 'string' && name.length > 0,
      'setOutput: name must be non-empty'
    );
    assert.ok(typeof value === 'string', 'setOutput: value must be a string');
    console.log(`  ${fmt.dim(`output ${name}=${value}`)}`);
  }
}
