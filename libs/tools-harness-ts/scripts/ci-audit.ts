// @io-wall-ok — pure gate over current registry evidence injected by Verify/Release.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditSnapshot } from './audit-snapshot';
import { AUDIT_SNAPSHOT } from './audit-snapshot';

export function auditVerdict(json: string): AuditSnapshot {
  const snapshot = JSON.parse(json) as AuditSnapshot;
  if (
    snapshot.version !== 1 ||
    !Number.isSafeInteger(snapshot.status) ||
    snapshot.status < 0 ||
    snapshot.status > 255 ||
    !('advisories' in snapshot) ||
    (snapshot.reported !== undefined &&
      !Number.isSafeInteger(snapshot.reported))
  )
    throw new Error('Invalid current advisory evidence');
  return snapshot;
}

if (import.meta.main) {
  const path =
    process.argv[2] ?? join(import.meta.dirname, '../../..', AUDIT_SNAPSHOT);
  const snapshot = auditVerdict(readFileSync(path, 'utf8'));
  if (snapshot.error) console.error(snapshot.error);
  if (snapshot.reported !== undefined)
    console.error(
      `Reported, not enforced: the registry's advisories exit ${snapshot.reported} (VERIFY_ADVISORIES=report)`
    );
  console.log(JSON.stringify(snapshot.advisories));
  process.exit(snapshot.status);
}
