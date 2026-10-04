// @io-wall-ok — CLI client: submissions use the root HTTP API
import { resolve } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import { HttpIssueReporter } from '@pkgs/feedback-client/http-issue-reporter';
import { readFeedbackReport } from '@pkgs/feedback-shared/read-report';
import { createFeedbackReporting } from '@pkgs/feedback-shared/reporting';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { readBytes } from '@pkgs/object-store-shared/helpers';

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
      const report = readFeedbackReport(
        JSON.parse(new TextDecoder().decode(await readBytes(object.body)))
      );
      console.log(
        JSON.stringify({
          schema: report.schema,
          id: report.id,
          kind: report.kind,
          title: report.title,
          status: report.status,
          createdAt: report.createdAt,
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
  console.log(
    JSON.stringify(
      readFeedbackReport(
        JSON.parse(new TextDecoder().decode(await readBytes(report.body)))
      ),
      null,
      2
    )
  );
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
      'problem') as import('@pkgs/feedback-shared/types').FeedbackKind,
    body: args[1] ?? '',
    title: args[2] ?? '',
  });
  console.log(result.issue.location ?? result.issue.id);
}
