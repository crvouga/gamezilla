// @io-wall-ok — CLI client: submissions use the root HTTP API
import { resolve } from 'node:path';
import { HttpIssueReporter } from '@pkgs/bug-report/client';
import { createBugReporting } from '@pkgs/bug-report/shared';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import { readBytes } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

const store = createNodeFsObjectStore({
  rootDir: resolve(import.meta.dirname, '../../../.bugs'),
  layout: 'tree',
  fs: wallNodeFs(),
});
const args = process.argv.slice(2);
if (args[0] === '--list') {
  // report.json is authoritative even if a crash prevented writing the index.
  const keys = (await store.listKeys()).filter((key) =>
    /^bug-[^/]+\/report.json$/.test(key)
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
          path: `.bugs/${key.replace('report.json', 'report.md')}`,
        })
      );
    } catch {
      console.error(`Unreadable report: .bugs/${key}`);
    }
  }
} else {
  const reporter = new HttpIssueReporter({
    endpoint:
      process.env['BUG_REPORT_API_URL'] ??
      'http://localhost:5173/api/bug-reports',
    timers: wallTimers,
    http: createGlobalHttpClient(),
  });
  const result = await createBugReporting({
    reporter,
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
  }).submit({ title: args[0] ?? '', description: args[1] ?? '' });
  console.log(result.issue.location ?? result.issue.id);
}
