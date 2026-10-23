/**
 * Moderation checks: the unit a policy is declared from.
 *
 * A check inspects one piece of text and reports findings. Every finding
 * carries the action it demands:
 *
 * - `refuse` — a write carrying the text is refused, and text already stored
 *   (written before the check existed) is masked wherever it is shown.
 * - `mask` — the write is accepted but the text is masked wherever it is
 *   shown (lower-confidence signals, or verdicts that arrive after the write).
 *
 * Checks come in two tiers:
 *
 * - `static` — pure, synchronous, deterministic. Runs everywhere: as a person
 *   types, inside mutations (client optimistic apply and authoritative server
 *   replay alike), and on every display. Results are memoized per text.
 * - `dynamic` — asynchronous and possibly remote (a classifier, a reputation
 *   service). Runs server-side only; its findings are stored keyed by
 *   `(check id, check version, content key)` and joined in at display time.
 *
 * `version` is part of a check's identity: bump it whenever the check's
 * behavior changes so stored dynamic verdicts from the old version stop
 * applying (and are re-evaluated) instead of being backfilled.
 */

export type ModerationAction = 'mask' | 'refuse';

export type ModerationFinding = {
  /** Id of the check that produced the finding. */
  readonly check: string;
  /** Stable machine reason within the check (`profanity`, `link`, …). */
  readonly code: string;
  readonly action: ModerationAction;
};

/** What a check's `inspect` reports before the framework stamps its id. */
export type ModerationHit = {
  readonly code: string;
  readonly action?: ModerationAction | undefined;
};

type CheckIdentity = {
  /** Stable, unique within a policy (`profanity.obscenity`). */
  readonly id: string;
  /** Bump when behavior changes; invalidates stored dynamic verdicts. */
  readonly version: number;
  /** Action for hits that do not name their own. Default `refuse`. */
  readonly action?: ModerationAction | undefined;
};

export type StaticModerationCheck = CheckIdentity & {
  readonly tier: 'static';
  readonly inspect: (text: string) => ModerationHit | null;
};

export type DynamicModerationCheck = CheckIdentity & {
  readonly tier: 'dynamic';
  readonly inspect: (text: string) => Promise<ModerationHit | null>;
};

export type ModerationCheck = StaticModerationCheck | DynamicModerationCheck;

export function defineStaticCheck(
  check: Omit<StaticModerationCheck, 'tier'>
): StaticModerationCheck {
  return { ...check, tier: 'static' };
}

export function defineDynamicCheck(
  check: Omit<DynamicModerationCheck, 'tier'>
): DynamicModerationCheck {
  return { ...check, tier: 'dynamic' };
}

/** `id@version` — the key stored dynamic verdicts are matched on. */
export function checkKey(check: CheckIdentity): string {
  return `${check.id}@${String(check.version)}`;
}

export function toFinding(
  check: CheckIdentity,
  hit: ModerationHit
): ModerationFinding {
  return {
    check: check.id,
    code: hit.code,
    action: hit.action ?? check.action ?? 'refuse',
  };
}

/** A static check refusing (or masking) text a predicate matches. */
export function predicateCheck(options: {
  readonly id: string;
  readonly version: number;
  readonly code: string;
  readonly action?: ModerationAction | undefined;
  readonly matches: (text: string) => boolean;
}): StaticModerationCheck {
  const hit: ModerationHit = { code: options.code };
  return defineStaticCheck({
    id: options.id,
    version: options.version,
    action: options.action,
    inspect: (text) => (options.matches(text) ? hit : null),
  });
}
