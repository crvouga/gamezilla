import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { publishReportTask, verifyPublications } from './report-task-publish';

const taskId = '@libs/example#test:spec:0';
const sha = 'commit';

describe('report completion receipts', () => {
  test('accepts an explicitly completed empty part and rejects missing or stale publications', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'report-publication-'));
    const store = new ObjectStoreImplInMemory();
    try {
      const args = { store, sha, runId: 'current', taskIds: [taskId] };
      await expect(verifyPublications(args)).rejects.toThrow(
        'Report not published'
      );
      await expect(
        publishReportTask({ ...args, repoRoot, taskId })
      ).rejects.toThrow('Missing report output');
      mkdirSync(join(repoRoot, 'libs/example/.cache/harness-report/part-0'), {
        recursive: true,
      });
      await expect(
        publishReportTask({ ...args, repoRoot, taskId })
      ).rejects.toThrow('Missing report output');
      writeFileSync(
        join(
          repoRoot,
          'libs/example/.cache/harness-report/part-0/complete.json'
        ),
        '{"status":0}'
      );
      await publishReportTask({ ...args, repoRoot, taskId });
      await verifyPublications(args);
      await expect(
        verifyPublications({ ...args, runId: 'next' })
      ).rejects.toThrow('Report not published');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
