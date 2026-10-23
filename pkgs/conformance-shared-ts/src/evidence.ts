/**
 * Machine-generated evidence for one spec file: what each obligation of the
 * spec resolved to when a runner checked it against the implementation. The
 * conformance report reads these and nothing else, so a verdict is
 * reproducible from the specs, the artifact and the evidence alone.
 *
 * An obligation resolves only to `pass` or `fail`. There is no `skipped`,
 * `unknown` or `manual`: a runner that could not decide an obligation records
 * `fail` and says why.
 */

/** The spec languages under `specs/<context>/`, by what they own. */
export const SPEC_KINDS = [
  'behavior',
  'dynamics',
  'decisions',
  'structure',
  'objectives',
] as const;
export type SpecKind = (typeof SPEC_KINDS)[number];

/** The pipeline layers a verdict is reported in (strategy § 13). */
export const LAYERS = [
  'specification',
  'implementation',
  'system',
  'release',
  'completeness',
] as const;
export type Layer = (typeof LAYERS)[number];

export type ObligationStatus = 'pass' | 'fail';

export type Obligation = {
  /** Stable within the spec (`valid`, `case:guest/host-a-space/on/application`). */
  readonly id: string;
  readonly layer: Layer;
  readonly status: ObligationStatus;
  /** Why it failed, or what it proved. */
  readonly detail?: string;
};

export type EvidenceRecord = {
  /** Repo-relative spec path (`specs/billing/access.dmn`). */
  readonly specUri: string;
  readonly kind: SpecKind;
  /** sha256 of the spec text the evidence was produced from. */
  readonly specSha256: string;
  /** The package whose runner produced it. */
  readonly packageName: string;
  readonly obligations: readonly Obligation[];
};

export function sha256(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

/** `specs/billing/access.dmn` → `billing-access-dmn`, a file-safe key. */
export function evidenceKey(specUri: string): string {
  return specUri
    .replace(/^specs\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['specUri'] === 'string' &&
    typeof record['kind'] === 'string' &&
    (SPEC_KINDS as readonly string[]).includes(record['kind']) &&
    typeof record['specSha256'] === 'string' &&
    typeof record['packageName'] === 'string' &&
    Array.isArray(record['obligations']) &&
    record['obligations'].every(isObligation)
  );
}

function isObligation(value: unknown): value is Obligation {
  if (typeof value !== 'object' || value === null) return false;
  const obligation = value as Record<string, unknown>;
  return (
    typeof obligation['id'] === 'string' &&
    typeof obligation['layer'] === 'string' &&
    (LAYERS as readonly string[]).includes(obligation['layer']) &&
    (obligation['status'] === 'pass' || obligation['status'] === 'fail')
  );
}
