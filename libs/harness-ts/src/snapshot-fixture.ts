import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveIdentityPlaceholders } from '@libs/product-identity-shared-ts/identity-placeholders';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared-ts/system-snapshot';
import { parseHarnessSystemSnapshotJson } from '@pkgs/harness-console-shared-ts/system-snapshot-schema';

/** Committed snapshots live with the package whose tests restore them. */
const FIXTURES_DIR = join(process.cwd(), 'fixtures/snapshots');

export function resolveHarnessSnapshotPath(id: string): string {
  const safe = id.trim();
  if (safe.length === 0 || /[\\/]/.test(safe) || safe.includes('..')) {
    throw new Error(`resolveHarnessSnapshotPath: invalid snapshot id '${id}'`);
  }
  return join(FIXTURES_DIR, `${safe}.json`);
}

/**
 * A committed fixture spells no identity value: technical keys
 * (`<namespace>.auth.bearer`) are stored as `{namespace}.…` and resolved
 * here on read (docs/BRANDING.md).
 */
export function parseHarnessSnapshotFixture(
  text: string
): HarnessSystemSnapshot {
  return parseHarnessSystemSnapshotJson(
    JSON.stringify(resolveIdentityPlaceholders(JSON.parse(text)))
  );
}

/** The fixture text for a snapshot: technical keys back to `{namespace}`. */
export function harnessSnapshotFixtureText(
  snapshot: HarnessSystemSnapshot
): string {
  return `${JSON.stringify(withNamespacePlaceholder(snapshot), null, 2)}\n`;
}

const NAMESPACED_KEY = new RegExp(`^${NAMESPACE}(?=[.:_])`);

function withNamespacePlaceholder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withNamespacePlaceholder);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(NAMESPACED_KEY, '{namespace}'),
        withNamespacePlaceholder(item),
      ])
    );
  return value;
}

export function readHarnessSystemSnapshot(id: string): HarnessSystemSnapshot {
  const path = resolveHarnessSnapshotPath(id);
  return parseHarnessSnapshotFixture(readFileSync(path, 'utf8'));
}

export function writeHarnessSystemSnapshot(
  id: string,
  snapshot: HarnessSystemSnapshot
): void {
  const path = resolveHarnessSnapshotPath(id);
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(path, harnessSnapshotFixtureText(snapshot), 'utf8');
}
