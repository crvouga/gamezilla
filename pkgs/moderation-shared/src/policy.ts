import type {
  DynamicModerationCheck,
  ModerationCheck,
  ModerationFinding,
  StaticModerationCheck,
} from './check';
import { checkKey } from './check';
import { contentKey } from './content-key';

/** Who a piece of content belongs to — feeds deterministic aliases. */
export type ModerationSubject = {
  /** Stable id of the entity the text names (profile id, space id). */
  readonly id: string;
};

/**
 * How masked content is shown. Stored text is never rewritten: the strategy
 * runs at display time, so changing it (or the checks) changes every screen
 * at once with nothing to backfill.
 *
 * - `alias` — a stand-in derived from the subject (a stable fake name).
 * - `censor` — the text with offending characters replaced.
 * - `hide` — no text; the caller shows its own fallback.
 */
export type MaskStrategy =
  | {
      readonly kind: 'alias';
      readonly alias: (subject: ModerationSubject) => string;
    }
  | { readonly kind: 'censor'; readonly censor: (text: string) => string }
  | { readonly kind: 'hide' };

export type ContentKindPolicy = {
  /** Ordered: cheap checks first. Static checks short-circuit on `refuse`. */
  readonly checks: readonly ModerationCheck[];
  readonly mask: MaskStrategy;
};

export type ModerationPolicy<K extends string> = {
  readonly kinds: Readonly<Record<K, CompiledKindPolicy>>;
  /** Changes whenever any kind's checks or check versions change. */
  readonly fingerprint: string;
};

export type CompiledKindPolicy = {
  readonly staticChecks: readonly StaticModerationCheck[];
  readonly dynamicChecks: readonly DynamicModerationCheck[];
  /** `id@version` of every dynamic check — stale verdicts are ignored. */
  readonly liveDynamicKeys: ReadonlySet<string>;
  readonly mask: MaskStrategy;
};

function compileKind(policy: ContentKindPolicy): CompiledKindPolicy {
  const ids = new Set<string>();
  for (const check of policy.checks) {
    if (ids.has(check.id)) {
      throw new Error(`moderation: duplicate check id "${check.id}"`);
    }
    ids.add(check.id);
  }
  const staticChecks = policy.checks.filter(
    (c): c is StaticModerationCheck => c.tier === 'static'
  );
  const dynamicChecks = policy.checks.filter(
    (c): c is DynamicModerationCheck => c.tier === 'dynamic'
  );
  return {
    staticChecks,
    dynamicChecks,
    liveDynamicKeys: new Set(dynamicChecks.map(checkKey)),
    mask: policy.mask,
  };
}

/**
 * Declare every kind of user-generated content and the checks it passes.
 * The one place moderation is configured: adding a kind, a check, or
 * changing a mask strategy is an edit here and nowhere else.
 */
export function defineModerationPolicy<K extends string>(
  kinds: Readonly<Record<K, ContentKindPolicy>>
): ModerationPolicy<K> {
  const compiled = {} as Record<K, CompiledKindPolicy>;
  const parts: string[] = [];
  for (const kind of Object.keys(kinds).sort() as K[]) {
    compiled[kind] = compileKind(kinds[kind]);
    parts.push(`${kind}:${kinds[kind].checks.map(checkKey).join(',')}`);
  }
  return { kinds: compiled, fingerprint: contentKey(parts.join('|')) };
}

/** A verdict a dynamic check produced, as persisted by the server. */
export type StoredDynamicVerdict = {
  /** `id@version` of the check that produced it. */
  readonly checkKey: string;
  readonly finding: ModerationFinding | null;
};

/**
 * Keep only verdicts from checks the policy still declares at the same
 * version: retiring or revising a check drops its old verdicts at once.
 */
export function liveDynamicFindings(
  kind: CompiledKindPolicy,
  verdicts: readonly StoredDynamicVerdict[]
): readonly ModerationFinding[] {
  const findings: ModerationFinding[] = [];
  for (const verdict of verdicts) {
    if (verdict.finding === null) continue;
    if (!kind.liveDynamicKeys.has(verdict.checkKey)) continue;
    findings.push(verdict.finding);
  }
  return findings;
}
