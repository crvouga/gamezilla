import { assert } from '@pkgs/assert';

import { validateQueryChannels } from '../../shared/validate-topics';
import type { QueryDef, QueryRegistry } from './types';

export function queryRegistry(qs: readonly QueryDef<unknown>[]): QueryRegistry {
  const out: Record<string, QueryDef<unknown>> = {};
  for (const q of qs) {
    assert.ok(out[q.name] === undefined, `Duplicate query name: ${q.name}`);
    assert.ok(
      Number.isFinite(q.limit) && q.limit > 0,
      `Query ${q.name}: hard limit required`
    );
    validateQueryChannels(q);
    out[q.name] = q;
  }
  return out;
}
