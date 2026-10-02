/**
 * Object-store key layout of the shared reports store. Every report is keyed
 * by the full commit sha, so runs of different code never share a key:
 *
 *   index/<13-digit inverted start ms>-<sha>.json   one per published commit;
 *                                                   sorted keys = newest first
 *   commits/<sha>/commit.json                       the commit's run record
 *   commits/<sha>/frame.css                         stylesheet for its snapshots
 *   commits/<sha>/sources/<source>.json             one source's test metas
 *   commits/<sha>/bundles/<source>.json              logical file locations
 *   commits/<sha>/blobs/<content hash>.gz            compressed chunks
 *
 * Logical test and frame keys below are entries in the bundle indexes.
 *
 * A source is one report bucket of one package (`libs-chess--part-2`).
 * Writers put a source's tests first and its `sources/` record last, so a
 * reader that sees the record can read every test it names.
 */

/**
 * Where the reports live in their bucket. Every reader and writer scopes its
 * store to it, so the keys below are relative to it.
 */
export const REPORTS_ROOT_PREFIX = 'spec-reports';

const SHA = /^[0-9a-f]{40}$/;
/** `sanitizeTestId` output: what the harness names tests and runs. */
const SEGMENT = /^[a-zA-Z0-9._-]+$/;
/** Inverted start times sort newest first while there are 13-digit ms. */
const INVERT_FROM = 9_999_999_999_999;

export const COMMITS_INDEX_PREFIX = 'index/';

export function isCommitSha(value: string): boolean {
  return SHA.test(value);
}

/** One path segment the harness could have written (never `.` or `..`). */
export function isKeySegment(value: string): boolean {
  return SEGMENT.test(value) && value !== '.' && value !== '..';
}

/** A frame file relative to its test (`frames/f-0001.state.json`). */
export function isFramePath(value: string): boolean {
  const parts = value.split('/');
  return parts.length > 0 && parts.every(isKeySegment);
}

function assertSha(sha: string): void {
  if (!isCommitSha(sha)) {
    throw new Error(`report key needs a full 40-hex commit sha, got "${sha}"`);
  }
}

/** `libs/chess` + `part-2` → `libs-chess--part-2`. */
export function sourceId(packageDir: string, bucket: string): string {
  const id = `${packageDir.replaceAll('/', '-')}--${bucket}`;
  if (!isKeySegment(id)) throw new Error(`not a report source: "${id}"`);
  return id;
}

export function commitIndexKey(sha: string, startedAtMs: number): string {
  assertSha(sha);
  const inverted = String(INVERT_FROM - Math.max(0, Math.floor(startedAtMs)));
  return `${COMMITS_INDEX_PREFIX}${inverted.padStart(13, '0')}-${sha}.json`;
}

/** The sha an index key names, or null for anything else. */
export function shaOfIndexKey(key: string): string | null {
  const m = /^index\/\d{13}-([0-9a-f]{40})\.json$/.exec(key);
  return m === null ? null : (m[1] ?? null);
}

export function commitPrefix(sha: string): string {
  assertSha(sha);
  return `commits/${sha}/`;
}

export function commitKey(sha: string): string {
  return `${commitPrefix(sha)}commit.json`;
}

export function frameCssKey(sha: string): string {
  return `${commitPrefix(sha)}frame.css`;
}

export function sourcesPrefix(sha: string): string {
  return `${commitPrefix(sha)}sources/`;
}

export function sourceKey(sha: string, source: string): string {
  if (!isKeySegment(source)) throw new Error(`not a source: "${source}"`);
  return `${sourcesPrefix(sha)}${source}.json`;
}

/** The source a `sources/` key names, or null for anything else. */
export function sourceOfKey(sha: string, key: string): string | null {
  const head = sourcesPrefix(sha);
  if (!key.startsWith(head) || !key.endsWith('.json')) return null;
  const source = key.slice(head.length, -'.json'.length);
  return isKeySegment(source) ? source : null;
}

export function remoteTestPrefix(
  sha: string,
  source: string,
  testId: string
): string {
  if (!isKeySegment(source)) throw new Error(`not a source: "${source}"`);
  if (!isKeySegment(testId)) throw new Error(`not a test id: "${testId}"`);
  return `${commitPrefix(sha)}tests/${source}/${testId}/`;
}

export function remoteTestReportKey(
  sha: string,
  source: string,
  testId: string
): string {
  return `${remoteTestPrefix(sha, source, testId)}report.json`;
}

export function remoteTestFileKey(
  sha: string,
  source: string,
  testId: string,
  file: string
): string {
  const rel = file.replace(/^\/+/, '');
  if (!isFramePath(rel)) throw new Error(`not a frame file: "${file}"`);
  return `${remoteTestPrefix(sha, source, testId)}${rel}`;
}

/**
 * The id a viewer shows for a test of a source (`libs-chess--part-2/monkey`):
 * unique across the commit, since two packages may both name a test `monkey`.
 */
export function viewerTestId(source: string, testId: string): string {
  return `${source}/${testId}`;
}

export function splitViewerTestId(
  id: string
): { readonly source: string; readonly testId: string } | null {
  const slash = id.indexOf('/');
  if (slash < 0) return null;
  const source = id.slice(0, slash);
  const testId = id.slice(slash + 1);
  return isKeySegment(source) && isKeySegment(testId)
    ? { source, testId }
    : null;
}
