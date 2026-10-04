import { assert } from '@pkgs/assert-shared/singleton';
import type { QueryDef, QueryRegistry } from './queries-types';
import { validateQueryChannels } from './validate-topics';

export function queryRegistry(qs: readonly QueryDef<unknown>[]): QueryRegistry {
  const out: Record<string, QueryDef<unknown>> = {};
  for (const q of qs) {
    assert.ok(out[q.name] === undefined, `Duplicate query name: ${q.name}`);
    assert.ok(
      q.limit !== undefined && Number.isFinite(q.limit) && q.limit > 0,
      `Query ${q.name}: hard limit required`
    );
    validateQueryChannels(q);
    out[q.name] = q;
  }
  return out;
}
