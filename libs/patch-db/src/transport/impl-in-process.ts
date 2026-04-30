import { assert } from '@gamezilla/lib/assert';
import {
  assertPatch,
  assertPatchInput,
  assertQuery,
  OPEN_PATCHES_DB_CONTEXT,
  type Patch,
  type PatchesDbContext,
  type PatchesDbQuery,
  type PatchesDbResult,
  type PatchInput,
} from '../interface';
import type { PatchDbClientTransport, PatchDbSyncHost } from './interface';

function assertPatchesDbResultShape(r: PatchesDbResult, index: number): void {
  assert.ok(
    r !== null && r !== undefined,
    'PatchDbTransportInProcess.read: result must be defined',
    { index }
  );
  assert.record(r, 'PatchDbTransportInProcess.read: result must be an object');
  assert.ok('query' in r, 'PatchesDbResult must have query', { index });
  assert.array(r.entities, 'PatchesDbResult.entities must be an array', {
    index,
  });
  assert.array(r.patches, 'PatchesDbResult.patches must be an array', {
    index,
  });
  assert.number(r.total, 'PatchesDbResult.total must be a finite number');
  assert.ok(
    typeof r.hasMore === 'boolean',
    'PatchesDbResult.hasMore must be boolean',
    { index }
  );
  assert.ok(
    r.nextCursor === null || typeof r.nextCursor === 'string',
    'PatchesDbResult.nextCursor must be string or null',
    { index, nextCursor: r.nextCursor }
  );
}

/**
 * Trusted in-process client transport: delegates to {@link PatchDbSyncHost}
 * (same authority behavior as the HTTP server).
 */
export class PatchDbTransportInProcess implements PatchDbClientTransport {
  constructor(private host: PatchDbSyncHost) {
    assert.defined(
      host,
      'PatchDbTransportInProcess: PatchDbSyncHost must be defined'
    );
    assert.ok(
      typeof host.read === 'function',
      'PatchDbTransportInProcess: host.read must be a function'
    );
    assert.ok(
      typeof host.write === 'function',
      'PatchDbTransportInProcess: host.write must be a function'
    );
  }

  async read(
    queries: PatchesDbQuery[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchesDbResult[]> {
    assert.array(
      queries,
      'PatchDbTransportInProcess.read: queries must be an array'
    );
    assert.defined(
      this.host,
      'PatchDbTransportInProcess.read: host must be defined'
    );

    if (queries.length > 0) {
      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        assert.defined(
          q,
          'PatchDbTransportInProcess.read: query must be defined',
          { i }
        );
        assertQuery(assert, q);
      }
    }

    const results = await this.host.read(queries, ctx);
    assert.array(
      results,
      'PatchDbTransportInProcess.read: host.read must return an array'
    );

    if (queries.length === 0) {
      assert.ok(
        results.length === 0,
        'PatchDbTransportInProcess.read: empty queries must yield empty results',
        { actualLength: results.length }
      );
      return results;
    }

    assert.ok(
      results.length === queries.length,
      'PatchDbTransportInProcess.read: one result per query',
      { expected: queries.length, actual: results.length }
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      assert.defined(
        r,
        'PatchDbTransportInProcess.read: result slot must be defined',
        { i }
      );
      assertPatchesDbResultShape(r, i);
    }

    return results;
  }

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    assert.array(
      patches,
      'PatchDbTransportInProcess.write: patches must be an array'
    );
    assert.ok(
      patches.length > 0,
      'PatchDbTransportInProcess.write: patches must not be empty',
      { length: patches.length }
    );
    assert.defined(
      this.host,
      'PatchDbTransportInProcess.write: host must be defined'
    );

    assert.all(patches, (p): asserts p is PatchInput =>
      assertPatchInput(assert, p)
    );

    const out = await this.host.write(patches, ctx);
    assert.array(
      out,
      'PatchDbTransportInProcess.write: host.write must return an array'
    );
    assert.ok(
      out.length === patches.length,
      'PatchDbTransportInProcess.write: one Patch per input patch',
      { expected: patches.length, actual: out.length }
    );
    for (let i = 0; i < out.length; i++) {
      assertPatch(assert, out[i]);
    }

    return out;
  }
}
