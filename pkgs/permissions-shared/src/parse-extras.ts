import type { FactPredicate } from './facts';
import type {
  DenialReason,
  PolicyVersionMeta,
  RestrictionSpec,
  UiTreatment,
  UnlockEntry,
} from './policy';
import type { QuotaGrant, QuotaWindow, ResetBoundary } from './quota-window';

const MAX_ENTRIES = 256;
const WINDOWS: ReadonlySet<string> = new Set<QuotaWindow>([
  'day',
  'week',
  'month',
  'rolling24h',
  'lifetime',
]);
const BOUNDARIES: ReadonlySet<string> = new Set<ResetBoundary>([
  'utcMidnight',
  'userLocalMidnight',
]);
const REASONS: ReadonlySet<string> = new Set<DenialReason>([
  'not_granted',
  'quota_exhausted',
  'limit_reached',
  'requires_account',
  'requires_connection',
  'requires_recent_proof',
  'restricted',
]);
const TREATMENTS: ReadonlySet<string> = new Set<UiTreatment>([
  'hide',
  'lock',
  'soft',
]);

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPredicateValue(value: unknown): boolean {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

export function readPredicate(
  value: unknown,
  label: string,
  issues: string[]
): FactPredicate | undefined {
  if (value === undefined) return undefined;
  if (value === 'always') return 'always';
  if (!isPlainObject(value) || !Object.values(value).every(isPredicateValue)) {
    issues.push(`${label} must be "always" or an object of fact values`);
    return undefined;
  }
  return value as FactPredicate;
}

function isLimit(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0)
  );
}

function readQuotaGrant(
  value: unknown,
  label: string,
  issues: string[]
): QuotaGrant | undefined {
  if (value === 'unlimited') return { limit: null, window: 'lifetime' };
  if (!isPlainObject(value)) {
    issues.push(`${label} must be "unlimited" or a quota object`);
    return undefined;
  }
  const limit = value['limit'] === 'unlimited' ? null : value['limit'];
  const window = value['window'];
  const boundary = value['resetBoundary'];
  if (!isLimit(limit) || typeof window !== 'string' || !WINDOWS.has(window)) {
    issues.push(`${label} needs a limit and a known window`);
    return undefined;
  }
  if (boundary !== undefined && !BOUNDARIES.has(String(boundary))) {
    issues.push(`${label}.resetBoundary is unknown`);
    return undefined;
  }
  return {
    limit,
    window: window as QuotaWindow,
    ...(boundary === undefined
      ? {}
      : { resetBoundary: boundary as ResetBoundary }),
  };
}

function readRecord<T>(
  value: unknown,
  label: string,
  issues: string[],
  readEntry: (entry: unknown, entryLabel: string, key: string) => T | undefined
): Record<string, T> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value) || Object.keys(value).length > MAX_ENTRIES) {
    issues.push(`${label} must be an object of at most ${MAX_ENTRIES} entries`);
    return undefined;
  }
  const out: Record<string, T> = {};
  for (const [key, entry] of Object.entries(value)) {
    const read = readEntry(entry, `${label}["${key}"]`, key);
    if (read !== undefined) out[key] = read;
  }
  return out;
}

export function readQuotas(
  value: unknown,
  label: string,
  issues: string[]
): Record<string, QuotaGrant> | undefined {
  return readRecord(value, label, issues, (entry, entryLabel) =>
    readQuotaGrant(entry, entryLabel, issues)
  );
}

export function readParams(
  value: unknown,
  label: string,
  issues: string[]
): Record<string, number | null> | undefined {
  return readRecord(value, label, issues, (entry, entryLabel) => {
    const parsed = entry === 'unlimited' ? null : entry;
    if (parsed === null || typeof parsed === 'number') return parsed;
    issues.push(`${entryLabel} must be a number or "unlimited"`);
    return undefined;
  });
}

function readRestriction(
  value: unknown,
  label: string,
  issues: string[]
): RestrictionSpec | undefined {
  if (!isPlainObject(value)) {
    issues.push(`${label} must be an object`);
    return undefined;
  }
  const when = readPredicate(value['when'], `${label}.when`, issues);
  const deny = value['deny'];
  if (
    when === undefined ||
    !Array.isArray(deny) ||
    !deny.every((d) => typeof d === 'string')
  ) {
    issues.push(`${label} needs "when" and a string "deny" list`);
    return undefined;
  }
  const reason = value['reason'];
  if (reason !== undefined && !REASONS.has(reason as string)) {
    issues.push(`${label}.reason must be a denial reason`);
    return undefined;
  }
  return {
    when,
    deny: [...(deny as string[])],
    ...(reason === undefined ? {} : { reason: reason as DenialReason }),
  };
}

function readUnlockEntry(
  value: unknown,
  label: string,
  issues: string[]
): UnlockEntry | undefined {
  if (!isPlainObject(value) || typeof value['titleKey'] !== 'string') {
    issues.push(`${label} needs a string titleKey`);
    return undefined;
  }
  const out: Record<string, string> = { titleKey: value['titleKey'] };
  for (const key of ['bodyKey', 'ctaTarget', 'secondaryCta'] as const) {
    if (typeof value[key] === 'string') out[key] = value[key];
  }
  return out as UnlockEntry;
}

function readUnlockRefs(
  value: unknown,
  issues: string[]
): PolicyVersionMeta['unlockRefs'] {
  return readRecord(value, 'policy.unlockRefs', issues, (entry, label) =>
    readRecord(entry, label, issues, (inner, innerLabel, reason) => {
      if (!REASONS.has(reason)) {
        issues.push(`${innerLabel}: unknown reason`);
        return undefined;
      }
      return readUnlockEntry(inner, innerLabel, issues);
    })
  );
}

function readEnumRecord<T extends string>(
  value: unknown,
  label: string,
  allowed: ReadonlySet<string>,
  issues: string[]
): Record<string, T> | undefined {
  return readRecord(value, label, issues, (entry, entryLabel) => {
    if (typeof entry === 'string' && allowed.has(entry)) return entry as T;
    issues.push(`${entryLabel} is not an allowed value`);
    return undefined;
  });
}

/** Parses the non-role fields of one policy version. */
export function readPolicyMeta(
  raw: Record<string, unknown>,
  issues: string[]
): PolicyVersionMeta {
  const version = raw['version'];
  const activeFromMs = raw['activeFromMs'];
  if (version !== undefined && typeof version !== 'string') {
    issues.push('policy.version must be a string');
  }
  if (
    activeFromMs !== undefined &&
    (typeof activeFromMs !== 'number' || !Number.isFinite(activeFromMs))
  ) {
    issues.push('policy.activeFromMs must be a finite number');
  }
  const restrictions = readRecord(
    raw['restrictions'],
    'policy.restrictions',
    issues,
    (entry, label) => readRestriction(entry, label, issues)
  );
  const unlockRefs = readUnlockRefs(raw['unlockRefs'], issues);
  const treatments = readEnumRecord<UiTreatment>(
    raw['treatments'],
    'policy.treatments',
    TREATMENTS,
    issues
  );
  const denialReasons = readEnumRecord<DenialReason>(
    raw['denialReasons'],
    'policy.denialReasons',
    REASONS,
    issues
  );
  return {
    ...(typeof version === 'string' ? { version } : {}),
    ...(typeof activeFromMs === 'number' ? { activeFromMs } : {}),
    ...(restrictions === undefined ? {} : { restrictions }),
    ...(unlockRefs === undefined ? {} : { unlockRefs }),
    ...(treatments === undefined ? {} : { treatments }),
    ...(denialReasons === undefined ? {} : { denialReasons }),
  };
}
