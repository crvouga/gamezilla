// @io-wall-ok — CLI client: submissions use the root HTTP API
import { resolve } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock';
import { HttpIssueReporter } from '@pkgs/feedback/client';
import { createFeedbackReporting } from '@pkgs/feedback/shared';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import { readBytes } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

const store = createNodeFsObjectStore({
  rootDir: resolve(import.meta.dirname, '../../../.feedback'),
  layout: 'tree',
  fs: wallNodeFs(),
});
const args = process.argv.slice(2);
if (args[0] === '--list') {
  // report.json is authoritative even if a crash prevented writing the index.
  const keys = (await store.listKeys()).filter((key) =>
    /^feedback-[^/]+\/report.json$/.test(key)
  );
  for (const key of keys) {
    const object = await store.get(key);
    if (!object) continue;
    try {
      const report = JSON.parse(
        new TextDecoder().decode(await readBytes(object.body))
      ) as { id: string; title: string; createdAt: string };
      console.log(
        JSON.stringify({
          ...report,
          path: `.feedback/${key.replace('report.json', 'report.md')}`,
        })
      );
    } catch {
      console.error(`Unreadable report: .feedback/${key}`);
    }
  }
} else if (args[0] === '--inspect') {
  const id = args[1] ?? '';
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id))
    throw new Error('Supply a report id from bun feedback --list');
  const report = await store.get(`feedback-${id}/report.json`);
  if (!report) throw new Error('Local feedback not found');
  console.log(new TextDecoder().decode(await readBytes(report.body)));
} else {
  const reporter = new HttpIssueReporter({
    endpoint:
      process.env['FEEDBACK_API_URL'] ?? 'http://localhost:5173/api/feedback',
    timers: wallTimers,
    http: createGlobalHttpClient(),
  });
  const result = await createFeedbackReporting({
    reporter,
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
  }).submit({
    kind: (args[0] ??
      'problem') as import('@pkgs/feedback/shared').FeedbackKind,
    description: args[1] ?? '',
    expected: args[2] ?? '',
    reproductionSteps: args[3] ?? '',
  });
  console.log(result.issue.location ?? result.issue.id);
}
