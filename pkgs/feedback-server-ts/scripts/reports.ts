// @io-wall-ok — CLI over the bug reports local development archives
import { resolve } from 'node:path';
import { bugReportTitle } from '@pkgs/feedback-shared-ts/bug-report';
import type { BugReport } from '@pkgs/feedback-shared-ts/types';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';

const store = createNodeFsObjectStore({
  rootDir: resolve(import.meta.dirname, '../../../.feedback'),
  layout: 'tree',
  fs: wallNodeFs(),
});

async function read(key: string): Promise<BugReport | null> {
  const text = await readUtf8(store, key);
  if (text === null) return null;
  try {
    return JSON.parse(text) as BugReport;
  } catch {
    return null;
  }
}

const [command, id = ''] = process.argv.slice(2);
if (command === '--list') {
  const keys = (await store.listKeys('reports/')).filter((key) =>
    key.endsWith('/report.json')
  );
  for (const key of keys) {
    const report = await read(key);
    if (!report) {
      console.error(`Unreadable bug report: .feedback/${key}`);
      continue;
    }
    console.log(
      JSON.stringify({
        id: report.id,
        title: bugReportTitle(report.description),
        createdAt: report.createdAt,
        screenshots: report.screenshots.length,
        path: `.feedback/${key.replace('report.json', 'report.md')}`,
      })
    );
  }
} else if (command === '--inspect') {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id))
    throw new Error('Supply a bug report id from bun feedback --list');
  const report = await read(`reports/${id}/report.json`);
  if (!report) throw new Error('Bug report not found');
  console.log(JSON.stringify(report, null, 2));
} else {
  throw new Error('Usage: bun feedback --list | --inspect <id>');
}
