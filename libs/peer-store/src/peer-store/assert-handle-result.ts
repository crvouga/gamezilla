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
    crash.array(result.events, 'handle success must have events array');
    const effects = result.effects;
    if (effects !== undefined) {
      crash.array(effects, 'handle success effects must be an array');
      for (const effect of effects) {
        crash.record(effect, 'effect must be a plain object');
        crash.nonEmptyString(effect.type, 'effect.type must be non-empty');
      }
    }
  } else {
    crash.record(result.error, 'handle error must be a plain object');
    crash.nonEmptyString(
      result.error.type,
      'handle error must have non-empty type',
    );
  }
}
