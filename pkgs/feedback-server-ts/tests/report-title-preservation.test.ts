import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { FakeIssueReporter } from '@pkgs/feedback-server-ts/fake-issue-reporter';
import { FileSystemIssueReporter } from '@pkgs/feedback-server-ts/filesystem-issue-reporter';
import { createFeedbackReporting } from '@pkgs/feedback-shared-ts/reporting';
import { readBytes } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

// regression: feedback-preservation-property-raw-heading-title
test('an empty Markdown heading keeps its fallback title when diagnostics fail', async () => {
  const reporter = new FakeIssueReporter();
  const { clock, timers } = createHarnessClock();
  const result = await createFeedbackReporting({
    reporter,
    clock,
    timers,
    createId: () => 'fixed-id',
    providers: [
      {
        name: 'throw',
        collect() {
          throw new Error('Context unavailable');
        },
      },
    ],
  }).submit({ kind: 'problem', title: '', body: '#  ' });
  expect(result.report.title).toBe('Bug report');
  const report = await result.enriched;
  expect(report.title).toBe('Bug report');
  expect(report.body.source).toBe('#  ');
  expect(report.diagnostics[0]?.status).toBe('unavailable');
});

test('the authoritative file retains the fallback title when companion write 3 fails', async () => {
  let writes = 0;
  const store = new ObjectStoreImplInMemory({
    onFault: () => (++writes === 3 ? new Error('Disk interrupted') : null),
  });
  const { clock, timers } = createHarnessClock();
  const result = await createFeedbackReporting({
    reporter: new FileSystemIssueReporter(store),
    clock,
    timers,
    createId: () => 'durable-id',
  }).submit({ kind: 'problem', title: '', body: '#  ' });
  await result.enriched;
  const object = await store.get('feedback-durable-id/report.json');
  expect(object).not.toBeNull();
  const saved = JSON.parse(
    new TextDecoder().decode(await readBytes(object!.body))
  ) as { title: string; body: { source: string } };
  expect(saved.title).toBe('Bug report');
  expect(saved.body.source).toBe('#  ');
});
