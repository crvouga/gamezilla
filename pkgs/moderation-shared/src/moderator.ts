import type { ModerationFinding } from './check';
import { checkKey, toFinding } from './check';
import { Lru } from './lru';
import type {
  CompiledKindPolicy,
  ModerationPolicy,
  ModerationSubject,
  StoredDynamicVerdict,
} from './policy';
import { liveDynamicFindings } from './policy';

export type WriteVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      /** The first refusing finding — what to tell the person. */
      readonly finding: ModerationFinding;
    };

export type DisplayText =
  | { readonly masked: false; readonly text: string }
  | {
      readonly masked: true;
      /** Stand-in to show, or `null` when the kind hides masked text. */
      readonly text: string | null;
      readonly findings: readonly ModerationFinding[];
    };

export type Moderator<K extends string> = {
  readonly fingerprint: string;
  /** Static findings for `text`, memoized per policy and text. */
  inspect(kind: K, text: string): readonly ModerationFinding[];
  /** Whether a write carrying `text` is accepted (static checks only). */
  checkWrite(kind: K, text: string): WriteVerdict;
  /**
   * What to show for stored `text`, judged by the policy as it is now plus
   * any stored dynamic verdicts. Never mutates or rewrites the source.
   */
  display(
    kind: K,
    text: string,
    subject: ModerationSubject,
    dynamic?: readonly StoredDynamicVerdict[]
  ): DisplayText;
  /** Run every dynamic check (server side); persist the result as given. */
  inspectDynamic(kind: K, text: string): Promise<StoredDynamicVerdict[]>;
};

export type ModeratorOptions = {
  /** Memoized texts kept per moderator. Default 4096. */
  readonly cacheSize?: number | undefined;
};

const NO_FINDINGS: readonly ModerationFinding[] = Object.freeze([]);

function runStatic(
  kind: CompiledKindPolicy,
  text: string
): readonly ModerationFinding[] {
  let findings: ModerationFinding[] | null = null;
  for (const check of kind.staticChecks) {
    const hit = check.inspect(text);
    if (hit === null) continue;
    const finding = toFinding(check, hit);
    if (finding.action === 'refuse') return [finding];
    findings ??= [];
    findings.push(finding);
  }
  return findings ?? NO_FINDINGS;
}

/**
 * Bind a policy to its caches. One moderator per process (or per Solid
 * root) is enough: every call is pure in `(policy, text, subject)`.
 */
export function createModerator<K extends string>(
  policy: ModerationPolicy<K>,
  options: ModeratorOptions = {}
): Moderator<K> {
  const capacity = options.cacheSize ?? 4096;
  const findingsCache = new Lru<readonly ModerationFinding[]>(capacity);
  const aliasCache = new Lru<string>(capacity);

  const inspect = (kind: K, text: string): readonly ModerationFinding[] => {
    if (text.length === 0) return NO_FINDINGS;
    const key = `${kind}\u0000${text}`;
    const cached = findingsCache.get(key);
    if (cached !== undefined) return cached;
    const findings = runStatic(policy.kinds[kind], text);
    findingsCache.set(key, findings);
    return findings;
  };

  const maskText = (
    kind: K,
    text: string,
    subject: ModerationSubject
  ): string | null => {
    const mask = policy.kinds[kind].mask;
    if (mask.kind === 'hide') return null;
    if (mask.kind === 'censor') return mask.censor(text);
    const key = `${kind}\u0000${subject.id}`;
    const cached = aliasCache.get(key);
    if (cached !== undefined) return cached;
    const alias = mask.alias(subject);
    aliasCache.set(key, alias);
    return alias;
  };

  return {
    fingerprint: policy.fingerprint,
    inspect,
    checkWrite(kind, text) {
      const refusal = inspect(kind, text).find((f) => f.action === 'refuse');
      return refusal === undefined
        ? { allowed: true }
        : { allowed: false, finding: refusal };
    },
    display(kind, text, subject, dynamic) {
      const staticFindings = inspect(kind, text);
      const dynamicFindings =
        dynamic === undefined || dynamic.length === 0
          ? NO_FINDINGS
          : liveDynamicFindings(policy.kinds[kind], dynamic);
      if (staticFindings.length === 0 && dynamicFindings.length === 0) {
        return { masked: false, text };
      }
      return {
        masked: true,
        text: maskText(kind, text, subject),
        findings: [...staticFindings, ...dynamicFindings],
      };
    },
    async inspectDynamic(kind, text) {
      const checks = policy.kinds[kind].dynamicChecks;
      return Promise.all(
        checks.map(async (check) => {
          const hit = await check.inspect(text);
          return {
            checkKey: checkKey(check),
            finding: hit === null ? null : toFinding(check, hit),
          };
        })
      );
    },
  };
}
