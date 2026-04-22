import { isAtLeastLatest } from './semver';
import type { Dep } from './types';

export type DepVersionIssue =
  | { kind: 'missing'; name: string; reason: string }
  | { kind: 'outdated'; name: string; current: string; latest: string };

/** Resolves installed version + latest upstream; records missing/outdated deps. */
export async function collectDepVersionIssues(
  dep: Dep,
): Promise<
  | { ok: true; name: string; version: string }
  | { ok: false; issue: DepVersionIssue }
  | { ok: 'unknown-latest'; name: string; version: string }
> {
  const status = dep.check();
  if (!status.ok) {
    return {
      ok: false,
      issue: { kind: 'missing', name: dep.name, reason: status.reason },
    };
  }
  const latest = await dep.fetchLatestVersion();
  if (!latest) {
    return { ok: 'unknown-latest', name: dep.name, version: status.version };
  }
  if (!isAtLeastLatest(status.version, latest)) {
    return {
      ok: false,
      issue: {
        kind: 'outdated',
        name: dep.name,
        current: status.version,
        latest,
      },
    };
  }
  return { ok: true, name: dep.name, version: status.version };
}
