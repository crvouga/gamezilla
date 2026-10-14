import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { FakeIssueReporter } from '@pkgs/feedback-server/fake-issue-reporter';
import { FileSystemIssueReporter } from '@pkgs/feedback-server/filesystem-issue-reporter';
import { createFeedbackReporting } from '@pkgs/feedback-shared/reporting';
import type { DiagnosticProvider } from '@pkgs/feedback-shared/types';
import { readBytes } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const text = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((value) => value.trim().length > 0);
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
    fc.asyncProperty(text, fault, async (body, kind) => {
      const reporter = new FakeIssueReporter();
      const { clock, timers } = createHarnessClock();
      const service = createFeedbackReporting({
        reporter,
        clock,
        timers,
        createId: () => 'fixed-id',
        providers: [provider(kind)],
      });
      const result = await service.submit({
        kind: 'problem',
        title: '',
        body,
      });
      expect(reporter.reports.get(result.issue.id)?.body.source).toBe(body);
      await Promise.resolve();
      await Promise.resolve();
      clock.advance(500);
      const report = await result.enriched;
      expect(report.title).toBe(result.report.title);
      expect(report.body.source).toBe(result.report.body.source);
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
      fc.integer({ min: 3, max: 5 }),
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
        }).submit({
          kind: 'problem',
          title: '',
          body: title,
        });
        expect(result.issue.id).toBe('durable-id');
        const object = await store.get('feedback-durable-id/report.json');
        expect(object).not.toBeNull();
        const saved = JSON.parse(
          new TextDecoder().decode(await readBytes(object!.body))
        ) as { title: string; body: { source: string } };
        expect(saved.title).toBe(result.report.title);
        expect(saved.body.source).toBe(result.report.body.source);
        await result.enriched;
      }
    )
  );
});

test('broken clock and id ports still produce an emergency report', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(text, async (body) => {
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
      const result = await service.submit({
        kind: 'problem',
        title: '',
        body,
      });
      expect(result.report.createdAt).toBe('unknown');
      expect(result.report.body.source).toBe(body);
      expect(reporter.reports.size).toBe(1);
    })
  );
});

// regression: feedback-markdown-title-property-assumes-raw-line
test('an empty Markdown heading keeps its fallback title when diagnostics fail', async () => {
  const reporter = new FakeIssueReporter();
  const { clock, timers } = createHarnessClock();
  const result = await createFeedbackReporting({
    reporter,
    clock,
    timers,
    createId: () => 'heading-regression',
    providers: [provider('throw')],
  }).submit({ kind: 'problem', title: '', body: '#  ' });
  expect(result.report.title).toBe('Bug report');
  expect(result.report.body.source).toBe('#  ');
  const enriched = await result.enriched;
  expect(enriched.title).toBe('Bug report');
  expect(enriched.body.source).toBe('#  ');
  expect(enriched.diagnostics[0]?.status).toBe('unavailable');
  expect(reporter.reports.get(result.issue.id)?.title).toBe('Bug report');
});
