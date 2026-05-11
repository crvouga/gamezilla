import { assert } from '@gamezilla/lib/assert';
import {
  assertPatch,
  assertPatchInput,
  assertQuery,
  OPEN_PATCHES_DB_CONTEXT,
  type PatchDbQuery,
  type PatchDbResult,
  type PatchInput,
  type WritePatchesResult,
} from '../interface';
import { assertWriteResponse } from '../validate-remote';
import type { PatchDbClientTransport, PatchDbSyncHost } from './interface';
import { MAX_PATCHES_PER_REQUEST } from './wire-schemas';

function assertPatchDbResultShape(r: PatchDbResult, index: number): void {
  assert.ok(
    r !== null && r !== undefined,
    'PatchDbTransportInProcess.read: result must be defined',
    { index }
  );
  assert.record(r, 'PatchDbTransportInProcess.read: result must be an object');
  assert.ok('query' in r, 'PatchDbResult must have query', { index });
  assert.array(r.entities, 'PatchDbResult.entities must be an array', {
    index,
  });
  assert.array(r.patches, 'PatchDbResult.patches must be an array', {
    index,
  });
  assert.number(r.total, 'PatchDbResult.total must be a finite number');
  assert.ok(
    typeof r.hasMore === 'boolean',
    'PatchDbResult.hasMore must be boolean',
    {
      index,
    }
  );
  assert.ok(
    r.nextCursor === null || typeof r.nextCursor === 'string',
    'PatchDbResult.nextCursor must be string or null',
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
    queries: PatchDbQuery[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
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
      assertPatchDbResultShape(r, i);
    }

    return results;
  }

  async write(
    patches: PatchInput[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    assert.array(
      patches,
      'PatchDbTransportInProcess.write: patches must be an array'
    );
    assert.ok(
      patches.length > 0,
      'PatchDbTransportInProcess.write: patches must not be empty',
      { length: patches.length }
    );
    assert.ok(
      patches.length <= MAX_PATCHES_PER_REQUEST,
      'PatchDbTransportInProcess.write: batch exceeds MAX_PATCHES_PER_REQUEST',
      { length: patches.length, max: MAX_PATCHES_PER_REQUEST }
    );
    assert.defined(
      this.host,
      'PatchDbTransportInProcess.write: host must be defined'
    );

    assert.all(patches, (p): asserts p is PatchInput =>
      assertPatchInput(assert, p)
    );

    const out: WritePatchesResult = await this.host.write(patches, ctx);
    assertWriteResponse(out);
    assert.ok(
      out.accepted.length + out.rejected.length === patches.length,
      'PatchDbTransportInProcess.write: host.write must account for every input patch',
      {
        expected: patches.length,
        accepted: out.accepted.length,
        rejected: out.rejected.length,
      }
    );
    for (const p of out.accepted) {
      assertPatch(assert, p);
    }

    return out;
  }
}
