import { describe, expect, test } from 'bun:test';
import { reconcileIndexes } from '@pkgs/db-indexes-root-shared-ts/reconcile';
import type {
  UsageInfo,
  WorkloadManifest,
} from '@pkgs/db-indexes-root-shared-ts/types';
import { asOwnedIndexName } from '@pkgs/db-indexes-root-shared-ts/types';
import { fixedClock, RecordingPort } from './recording-port';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE = asOwnedIndexName('autoidx_notes_deadbeef');

/** A port whose scan counter rises between its first and later reads. */
class UsedWhileRetiringPort extends RecordingPort {
  private reads = 0;

  override async readIndexUsage(): Promise<UsageInfo[]> {
    this.reads += 1;
    return [{ name: STALE, scans: this.reads === 1 ? 5 : 7 }];
  }
}

const NO_QUERIES: WorkloadManifest = { version: 1, queries: [] };

describe('index used during retirement', () => {
  // regression: index-used-during-retirement
  test('a use observed while retiring cancels the drop', async () => {
    const db = new UsedWhileRetiringPort({
      indexes: [
        {
          name: STALE,
          table: 'notes',
          columns: ['user_id'],
          include: [],
          predicate: null,
          isUnique: false,
          isPrimary: false,
          isValid: true,
          isOwned: true,
        },
      ],
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      usage: [],
      metas: [
        {
          name: STALE,
          deprecatedAt: 0,
          usageAtDeprecation: 5,
          payload: '{}',
        },
      ],
    });
    const report = await reconcileIndexes({
      manifest: NO_QUERIES,
      db,
      clock: fixedClock(31 * DAY_MS),
      deadlineMs: 60_000,
    });
    expect(report.notes.some((n) => n.includes('window refreshed'))).toBe(true);
    expect(db.executed.filter((a) => a.kind === 'drop')).toEqual([]);
    expect(report.completed.filter((a) => a.kind === 'drop')).toEqual([]);
  });
});
