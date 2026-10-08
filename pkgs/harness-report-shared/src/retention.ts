import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { commitIndexKey, isCommitSha, shaOfIndexKey } from './keys';
import type { CommitRecord } from './protocol';
import { readCommit } from './read';
import { readStoredSource } from './source-content';

async function retainedPrefixes(
  store: ObjectStore,
  retained: readonly CommitRecord[]
): Promise<readonly string[]> {
  const prefixes: string[] = [];
  for (const record of retained) {
    const root = `commits/${record.sha}/`;
    prefixes.push(root);
    const text = await readUtf8(store, `${root}commit.json`);
    const pointer =
      text === null ? null : (JSON.parse(text) as { publicationId?: string });
    const data =
      pointer?.publicationId === undefined
        ? root
        : `attempts/${pointer.publicationId}/${root}`;
    if (data !== root) prefixes.push(data);
    for (const key of await store.listKeys(`${data}sources/`)) {
      const source = key.slice(`${data}sources/`.length).replace(/\.json$/, '');
      const stored = await readStoredSource(store, record.sha, source);
      if (stored?.contentPrefix.startsWith('content/'))
        prefixes.push(stored.contentPrefix);
    }
  }
  return prefixes;
}

export type ReportRetentionPlan = {
  readonly retained: readonly CommitRecord[];
  readonly deleteKeys: readonly string[];
};

/** Keep one report per existing branch, preferring its current head. */
export async function planReportRetention(
  store: ObjectStore,
  branches: ReadonlyMap<string, string>
): Promise<ReportRetentionPlan> {
  const keys = (
    await Promise.all(
      ['index/', 'commits/', 'attempts/', 'content/', 'versions/'].map(
        (prefix) => store.listKeys(prefix)
      )
    )
  ).flat();
  const shas = new Set<string>();
  for (const key of keys) {
    const sha = /^commits\/([0-9a-f]{40})\//.exec(key)?.[1];
    if (sha !== undefined && isCommitSha(sha)) shas.add(sha);
  }
  const latest = new Map<string, CommitRecord>();
  for (const sha of shas) {
    const record = await readCommit(store, sha);
    if (record === null || record.sha !== sha || !branches.has(record.branch))
      continue;
    const prior = latest.get(record.branch);
    const head = branches.get(record.branch);
    if (
      prior === undefined ||
      (record.sha === head && prior.sha !== head) ||
      (prior.sha !== head && record.startedAtMs > prior.startedAtMs)
    )
      latest.set(record.branch, record);
  }
  const retained = [...latest.values()];
  const prefixes = [...(await retainedPrefixes(store, retained))];
  for (const sha of branches.values())
    if (isCommitSha(sha)) prefixes.push(`commits/${sha}/`);
  // A running publisher has not attached all of its shared content yet.
  const publishing = retained.some((record) => record.state === 'running');
  const indexes = new Set(
    retained.map((record) => commitIndexKey(record.sha, record.startedAtMs))
  );
  const deleteKeys = keys.filter((key) => {
    if (key.startsWith('versions/')) {
      const sha = key.slice('versions/'.length).replace(/\.json$/, '');
      return !prefixes.includes(`commits/${sha}/`);
    }
    if (key.startsWith('index/'))
      return shaOfIndexKey(key) !== null && !indexes.has(key);
    if (key.startsWith('content/') && publishing) return false;
    return !prefixes.some((prefix) => key.startsWith(prefix));
  });
  return { retained, deleteKeys };
}

export async function pruneReports(
  store: ObjectStore,
  branches: ReadonlyMap<string, string>
): Promise<ReportRetentionPlan> {
  const plan = await planReportRetention(store, branches);
  await store.deleteMany(plan.deleteKeys);
  return plan;
}
