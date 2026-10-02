import type { ObjectStore } from '@pkgs/object-store/interface';
import { commitIndexKey, isCommitSha, shaOfIndexKey } from './keys';
import type { CommitRecord } from './protocol';
import { readCommit } from './read';

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
      ['index/', 'commits/'].map((prefix) => store.listKeys(prefix))
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
  const kept = new Set(retained.map((record) => record.sha));
  const indexes = new Set(
    retained.map((record) => commitIndexKey(record.sha, record.startedAtMs))
  );
  const deleteKeys = keys.filter((key) => {
    if (key.startsWith('index/'))
      return shaOfIndexKey(key) !== null && !indexes.has(key);
    const sha = /^commits\/([0-9a-f]{40})\//.exec(key)?.[1];
    return sha !== undefined && !kept.has(sha);
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
