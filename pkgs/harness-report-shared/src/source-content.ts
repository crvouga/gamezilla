/** A source can own commit-local files or reference a reusable complete source. */
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { commitPrefix, isKeySegment, sourceId, sourceKey } from './keys';
import type { SourceRecord } from './protocol';
import { reportStore } from './publication';

export type SourceIdentity = {
  readonly taskHash: string;
  readonly generation: number;
};

type SourceReference = {
  readonly record: SourceRecord;
  readonly contentPrefix: string;
};

export function reportGeneration(nowMs: number, retentionDays: number): number {
  if (!Number.isFinite(nowMs) || nowMs < 0)
    throw new Error('Report time must be nonnegative');
  if (!Number.isInteger(retentionDays) || retentionDays < 1)
    throw new Error('Report retention must be a positive number of days');
  return Math.floor(nowMs / (retentionDays * 86_400_000));
}

export function sourceContentPrefix(
  identity: SourceIdentity,
  source: string
): string {
  if (!/^[0-9a-f]{16,64}$/.test(identity.taskHash))
    throw new Error('Report identity needs an exact task hash');
  if (!Number.isSafeInteger(identity.generation) || identity.generation < 0)
    throw new Error('Report generation must be a nonnegative integer');
  if (!isKeySegment(source)) throw new Error('Invalid report source');
  return `content/v2/${identity.generation}/${identity.taskHash}/${source}/`;
}

export async function attachSource(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly record: SourceRecord;
    readonly contentPrefix: string;
  }
): Promise<void> {
  await writeUtf8(
    store,
    sourceKey(args.sha, args.record.source),
    JSON.stringify({ record: args.record, contentPrefix: args.contentPrefix }),
    'application/json; charset=utf-8'
  );
}

export async function reuseSource(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly packageDir: string;
    readonly bucket: string;
    readonly identity: SourceIdentity;
  }
): Promise<SourceRecord | null> {
  const source = sourceId(args.packageDir, args.bucket);
  const contentPrefix = sourceContentPrefix(args.identity, source);
  const text = await readUtf8(store, `${contentPrefix}complete.json`);
  if (text === null) return null;
  const record = JSON.parse(text) as SourceRecord;
  if (
    record.source !== source ||
    record.packageDir !== args.packageDir ||
    record.bucket !== args.bucket ||
    record.status !== 'passed'
  )
    return null;
  await attachSource(store, { sha: args.sha, record, contentPrefix });
  return record;
}

export async function readStoredSource(
  store: ObjectStore,
  sha: string,
  source: string
): Promise<SourceReference | null> {
  store = await reportStore(store, sha);
  const text = await readUtf8(store, sourceKey(sha, source));
  if (text === null) return null;
  const stored = JSON.parse(text) as SourceRecord | SourceReference;
  if ('record' in stored) {
    const prefix = stored.contentPrefix;
    if (
      !/^content\/v2\/\d+\/[0-9a-f]{16,64}\/[a-zA-Z0-9._-]+\/$/.test(prefix) ||
      !prefix.endsWith(`/${source}/`) ||
      stored.record.source !== source
    )
      throw new Error('Invalid report content reference');
    return stored;
  }
  return {
    record: stored,
    contentPrefix: `${commitPrefix(sha)}tests/${source}/`,
  };
}

export async function sourceTestPrefix(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly source: string;
    readonly testId: string;
  }
): Promise<string | null> {
  if (!isKeySegment(args.testId)) throw new Error('Invalid report test');
  const stored = await readStoredSource(store, args.sha, args.source);
  return stored === null ? null : `${stored.contentPrefix}${args.testId}/`;
}
