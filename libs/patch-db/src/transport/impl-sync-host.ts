import { assert } from '@gamezilla/lib/assert';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import {
  assertPatch,
  assertPatchInput,
  type Patch,
  type PatchesDb,
  type PatchesDbQuery,
  type PatchesDbResult,
  type PatchInput,
} from '../interface';
import type { PatchDbSyncHost } from './interface';

const PATCHES_DB_TOPIC = 'patches-db';

function assertPatchesDbResultShape(r: PatchesDbResult, index: number): void {
  assert.ok(
    r !== null && r !== undefined,
    'PatchDbImplSyncHost.read: result must be defined',
    { index }
  );
  assert.record(r, 'PatchDbImplSyncHost.read: result must be an object');
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
    {
      index,
    }
  );
  assert.ok(
    r.nextCursor === null || typeof r.nextCursor === 'string',
    'PatchesDbResult.nextCursor must be string or null',
    { index, nextCursor: r.nextCursor }
  );
}

export class PatchDbImplSyncHost implements PatchDbSyncHost {
  constructor(
    private db: PatchesDb,
    private pubSub: PubSub
  ) {
    assert.defined(db, 'PatchDbImplSyncHost: PatchesDb must be defined');
    assert.defined(pubSub, 'PatchDbImplSyncHost: PubSub must be defined');
  }

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    assert.array(queries, 'PatchDbImplSyncHost.read: queries must be an array');
    if (queries.length === 0) {
      return [];
    }

    const results = await this.db.read(queries);
    assert.array(
      results,
      'PatchDbImplSyncHost.read: db.read must return an array'
    );
    assert.ok(
      results.length === queries.length,
      'PatchDbImplSyncHost.read: db.read must return one result per query',
      {
        expected: queries.length,
        actual: results.length,
      }
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      assert.defined(
        r,
        'PatchDbImplSyncHost.read: result at index must be defined',
        { i }
      );
      assertPatchesDbResultShape(r, i);
    }

    return results;
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    assert.array(
      patches,
      'PatchDbImplSyncHost.write: patches must be an array'
    );
    assert.ok(
      patches.length > 0,
      'PatchDbImplSyncHost.write: patches must not be empty',
      { length: patches.length }
    );

    assert.all(patches, (p): asserts p is PatchInput =>
      assertPatchInput(assert, p)
    );

    const out = await this.db.write(patches);
    assert.array(
      out,
      'PatchDbImplSyncHost.write: db.write must return an array'
    );
    assert.ok(
      out.length === patches.length,
      'PatchDbImplSyncHost.write: db.write must return one Patch per input patch',
      { expected: patches.length, actual: out.length }
    );

    for (let i = 0; i < out.length; i++) {
      assertPatch(assert, out[i]);
    }

    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return out;
  }
}
