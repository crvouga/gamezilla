import { Assert } from '@gamezilla/lib/assert';
import type { HandleResult } from './peer-store-types';

const crash: Assert = Assert.crash();

export function assertHandleResult(result: HandleResult): void {
  crash.defined(result, 'module.handle must return a result');
  crash.ok(
    typeof result.ok === 'boolean',
    'handle result must have ok: boolean',
  );
  if (result.ok) {
    crash.array(result.value.events, 'handle success must have events array');
  } else {
    crash.record(result.error, 'handle error must be a plain object');
    crash.nonEmptyString(
      result.error.type,
      'handle error must have non-empty type',
    );
  }
}
