import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { publishReportTask, verifyPublications } from './report-task-publish';

const taskId = '@libs/example#test:spec:0';
const sha = 'a'.repeat(40);
const identity = { taskHash: '0123456789abcdef', generation: 0 };

describe('report completion receipts', () => {
  // regression: check-report-concurrent-run-receipt
  test('accepts an explicitly completed empty part and rejects missing or stale publications', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'report-publication-'));
    const store = new ObjectStoreImplInMemory();
    try {
      const args = {
        store,
        sha,
        runId: 'current',
        tasks: [{ taskId, hash: identity.taskHash }],
        identity,
      };
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
        verifyPublications({
          ...args,
          tasks: [{ taskId, hash: 'fedcba9876543210' }],
        })
      ).rejects.toThrow('Report not published');
      await expect(
        verifyPublications({ ...args, runId: 'next' })
      ).rejects.toThrow('Report not published');
      await publishReportTask({
        ...args,
        runId: 'concurrent',
        repoRoot,
        taskId,
      });
      await verifyPublications(args);
      await verifyPublications({ ...args, runId: 'concurrent' });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
