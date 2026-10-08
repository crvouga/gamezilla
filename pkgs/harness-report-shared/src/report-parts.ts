import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { inCompletionOrder } from './completion-order';
import type { EvidenceStatus, ReportPart } from './explorer-types';
import { recordExplorerVersion } from './explorer-versions';
import { isCommitSha, isKeySegment } from './keys';

const STATUSES = new Set(['passed', 'failed', 'running', 'not-run']);

export function partStatus(part: ReportPart): EvidenceStatus {
  const statuses = part.checks.map((check) => check.status);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('running')) return 'running';
  if (statuses.length === 0 || statuses.includes('not-run')) return 'not-run';
  return 'passed';
}

export function validatePart(part: ReportPart): void {
  if (
    !isCommitSha(part.sha) ||
    !isKeySegment(part.id) ||
    typeof part.kind !== 'string' ||
    !part.kind ||
    typeof part.title !== 'string' ||
    !part.title ||
    !Number.isSafeInteger(part.recordedAtMs) ||
    part.recordedAtMs < 0 ||
    !Array.isArray(part.checks)
  )
    throw new Error('Invalid report part');
  const ids = new Set<string>();
  for (const check of part.checks) {
    if (
      typeof check.id !== 'string' ||
      !check.id ||
      ids.has(check.id) ||
      typeof check.title !== 'string' ||
      !check.title ||
      typeof check.detail !== 'string' ||
      !STATUSES.has(check.status) ||
      !Array.isArray(check.measurements)
    )
      throw new Error('Invalid evidence check');
    ids.add(check.id);
    for (const measurement of check.measurements) {
      if (
        typeof measurement.name !== 'string' ||
        !measurement.name ||
        typeof measurement.unit !== 'string' ||
        !measurement.unit ||
        !Number.isFinite(measurement.value) ||
        (measurement.limit !== undefined && !Number.isFinite(measurement.limit))
      )
        throw new Error('Invalid evidence measurement');
    }
  }
}

function partsPrefix(sha: string): string {
  if (!isCommitSha(sha)) throw new Error('Invalid commit');
  return `commits/${sha}/parts/`;
}

/** Each producer owns a separate key, independent of the spec-run attempt. */
export async function publishPart(
  store: ObjectStore,
  part: ReportPart
): Promise<void> {
  validatePart(part);
  const json = JSON.stringify(part);
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
  );
  const hash = [...digest]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  await writeUtf8(
    store,
    `${partsPrefix(part.sha)}${part.id}/${part.recordedAtMs}-${hash}.json`,
    json,
    'application/json'
  );
  await recordExplorerVersion(store, part.sha);
}

/** Latest result per producer, sorted stably; corrupt evidence fails visibly. */
export async function readParts(
  store: ObjectStore,
  sha: string
): Promise<readonly ReportPart[]> {
  const keys = await store.listKeys(partsPrefix(sha));
  const parts: ReportPart[] = [];
  const tasks = keys.map((key) => async () => {
    const raw = await readUtf8(store, key);
    if (raw === null) throw new Error('Report part disappeared');
    const part = JSON.parse(raw) as ReportPart;
    validatePart(part);
    if (part.sha !== sha || !key.startsWith(`${partsPrefix(sha)}${part.id}/`))
      throw new Error('Report part belongs to another commit');
    return part;
  });
  for await (const part of inCompletionOrder(tasks, 16)) parts.push(part);
  return latestParts(parts);
}

/** Ties are conservative and independent of write/list order. */
export function latestParts(
  parts: readonly ReportPart[]
): readonly ReportPart[] {
  const latest = new Map<string, ReportPart>();
  const rank = { passed: 0, 'not-run': 1, running: 2, failed: 3 };
  for (const part of parts) {
    const previous = latest.get(part.id);
    if (
      !previous ||
      part.recordedAtMs > previous.recordedAtMs ||
      (part.recordedAtMs === previous.recordedAtMs &&
        (rank[partStatus(part)] > rank[partStatus(previous)] ||
          (rank[partStatus(part)] === rank[partStatus(previous)] &&
            JSON.stringify(part) > JSON.stringify(previous))))
    )
      latest.set(part.id, part);
  }
  return [...latest.values()].sort(
    (a, b) => compare(a.kind, b.kind) || compare(a.id, b.id)
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
