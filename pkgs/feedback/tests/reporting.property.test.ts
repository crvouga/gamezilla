import { expect, test } from 'bun:test';
import {
  FakeIssueReporter,
  FileSystemIssueReporter,
} from '@pkgs/feedback/server';
import {
  createFeedbackReporting,
  type DiagnosticProvider,
} from '@pkgs/feedback/shared';
import { createHarnessClock } from '@pkgs/clock';
import { readBytes } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { assertProperty, fc } from '@pkgs/property';

const text = fc.string({ maxLength: 200 });
const fault = fc.constantFrom(
  'throw',
  'reject',
  'cycle',
  'bigint',
  'hang',
  'oversize'
);
function provider(kind: string): DiagnosticProvider {
  return {
    name: kind,
    collect() {
      if (kind === 'throw') throw new Error('Context unavailable');
      if (kind === 'reject')
        return Promise.reject(new Error('Capture unavailable'));
      if (kind === 'cycle') {
        const value: { self?: unknown } = {};
        value.self = value;
        return value;
      }
      if (kind === 'bigint') return 4n;
      if (kind === 'hang') return new Promise(() => {});
      return 'x'.repeat(64_001);
    },
  };
}

test('optional diagnostics never erase the already-created report', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(text, text, fault, async (title, description, kind) => {
      const reporter = new FakeIssueReporter();
      const { clock, timers } = createHarnessClock();
      const service = createFeedbackReporting({
        reporter,
        clock,
        timers,
        createId: () => 'fixed-id',
        providers: [provider(kind)],
      });
      const result = await service.submit({ title, description });
      expect(reporter.reports.get(result.issue.id)?.description).toBe(
        description
      );
      await Promise.resolve();
      await Promise.resolve();
      clock.advance(500);
      const report = await result.enriched;
      expect(report.title).toBe(title.trim() || 'Emergency feedback report');
      expect(report.diagnostics[0]?.status).toBe('unavailable');
      expect(reporter.reports.size).toBe(1);
      expect(clock.pendingOneShotCount()).toBe(0);
    })
  );
});

test('companion-file or enrichment failure preserves the authoritative report', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(
      text,
      fc.integer({ min: 2, max: 4 }),
      async (title, failureAt) => {
        let writes = 0;
        const store = new ObjectStoreImplInMemory({
          onFault: () =>
            ++writes === failureAt ? new Error('Disk interrupted') : null,
        });
        const reporter = new FileSystemIssueReporter(store);
        const { clock, timers } = createHarnessClock();
        const result = await createFeedbackReporting({
          reporter,
          clock,
          timers,
          createId: () => 'durable-id',
        }).submit({ title, description: 'Board stopped' });
        expect(result.issue.id).toBe('durable-id');
        const object = await store.get('bug-durable-id/report.json');
        expect(object).not.toBeNull();
        const saved = JSON.parse(
          new TextDecoder().decode(await readBytes(object!.body))
        ) as { title: string };
        expect(saved.title).toBe(title.trim() || 'Emergency feedback report');
        await result.enriched;
      }
    )
  );
});

test('broken clock and id ports still produce an emergency report', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(text, async (description) => {
      const reporter = new FakeIssueReporter();
      const { timers } = createHarnessClock();
      const service = createFeedbackReporting({
        reporter,
        timers,
        clock: {
          now() {
            throw new Error('Clock broken');
          },
        },
        createId() {
          throw new Error('Id broken');
        },
      });
      const result = await service.submit({ title: '', description });
      expect(result.report.createdAt).toBe('unknown');
      expect(result.report.description).toBe(description);
      expect(reporter.reports.size).toBe(1);
    })
  );
});
