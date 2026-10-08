import type { SourceRecord } from '@pkgs/harness-report-shared/protocol';
import {
  listSourceRecords,
  readCommit,
} from '@pkgs/harness-report-shared/read';
import { readStoredSource } from '@pkgs/harness-report-shared/source-content';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

export type ReportsStores = {
  readonly store: ObjectStore | null;
  readonly localStore?: ObjectStore;
};

/** Collected local runs own their timelines; a remote outage cannot hide them. */
export async function reportsStoreForCommit(
  deps: ReportsStores,
  sha: string
): Promise<ObjectStore | null> {
  if (deps.localStore && (await readCommit(deps.localStore, sha)) !== null)
    return deps.localStore;
  return deps.store;
}

export async function reportsStoreForSource(
  deps: ReportsStores,
  sha: string,
  source: string
): Promise<ObjectStore | null> {
  if (
    deps.localStore &&
    (await readStoredSource(deps.localStore, sha, source)) !== null
  )
    return deps.localStore;
  return deps.store;
}

/** Merge independent producers; local output overrides only its own source. */
export async function reportsSources(
  deps: ReportsStores,
  sha: string
): Promise<readonly SourceRecord[]> {
  const stores = [deps.store, deps.localStore].filter((store) => store != null);
  const results = await Promise.allSettled(
    stores.map((store) => listSourceRecords(store, sha))
  );
  const sources = new Map<string, SourceRecord>();
  for (const result of results)
    if (result.status === 'fulfilled')
      for (const source of result.value) sources.set(source.source, source);
  const failure = results.find((result) => result.status === 'rejected');
  if (sources.size === 0 && failure?.status === 'rejected')
    throw failure.reason;
  return [...sources.values()];
}
