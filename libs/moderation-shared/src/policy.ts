import type { StaticModerationCheck } from '@pkgs/moderation-shared/check';
import { predicateCheck } from '@pkgs/moderation-shared/check';
import { linkCheck } from '@pkgs/moderation-shared/link-check';
import type { Moderator } from '@pkgs/moderation-shared/moderator';
import { createModerator } from '@pkgs/moderation-shared/moderator';
import { obscenityCheck } from '@pkgs/moderation-shared/obscenity-check';
import { defineModerationPolicy } from '@pkgs/moderation-shared/policy';
import { unicodeSafetyCheck } from '@pkgs/moderation-shared/unicode-safety-check';
import { containsBlockedTerm } from '@pkgs/word-filter-shared/match';

import { moderationAlias } from './alias';
import { reservedNameCheck } from './reserved-name-check';

/*
 * The one moderation policy for every piece of user-generated content.
 *
 * Each content kind lists its checks (cheapest first) and how masked text is
 * shown. The team's own rules — names it no longer allows — are data fed to
 * the same declaration as one more check per kind ({@link TeamRule}). The
 * policy is enforced at every level:
 *
 * 1. As a person types — forms check the draft against the moderation their
 *    app runs with (`useModeration()` on the client).
 * 2. In mutations — the body checks `env.contentRules`, which the host fills
 *    from the same rules: the client's optimistic apply and the server's
 *    authoritative replay refuse the same writes.
 * 3. On every display — stored text is judged by the rules as they are *now*,
 *    so a name the team stops allowing is masked at once and shows again when
 *    it starts allowing it. Stored text is never rewritten: no backfill, no
 *    data loss, fully reversible.
 * 4. Dynamic checks (`defineDynamicCheck`) run server-side; their verdicts
 *    are keyed by check version and joined in at display (level 3).
 *
 * Bump a check's `version` whenever its behavior changes.
 */

const unicodeSafety = unicodeSafetyCheck({ id: 'unicode.safety', version: 1 });

const inHouseBlocklist = predicateCheck({
  id: 'profanity.blocklist',
  version: 1,
  code: 'profanity',
  matches: containsBlockedTerm,
});

const englishProfanity = obscenityCheck({
  id: 'profanity.obscenity',
  version: 1,
});

const links = linkCheck({ id: 'spam.link', version: 1 });

/** Every kind of user-generated content the policy declares. */
export type ContentKind = 'username' | 'spaceTitle';

/**
 * A name the team no longer allows, from `sinceMs` on. Rules ship with the
 * app; a write made before a rule existed (queued offline) is judged by the
 * rules of its time.
 */
export type TeamRule = {
  readonly kind: ContentKind;
  readonly name: string;
  readonly sinceMs: number;
};

/** The team's rules this build of the app ships with. */
export const SHIPPED_TEAM_RULES: readonly TeamRule[] = [];

/** How a name is compared with the team's rules: case and spacing aside. */
export function teamRuleKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function teamRulesCheck(
  rules: readonly TeamRule[],
  kind: ContentKind
): StaticModerationCheck {
  const names = new Set(
    rules.filter((rule) => rule.kind === kind).map((r) => teamRuleKey(r.name))
  );
  return predicateCheck({
    id: 'team.no-longer-allowed',
    version: 1,
    code: 'no_longer_allowed',
    matches: (text) => names.has(teamRuleKey(text)),
  });
}

/** The product policy under the team's `rules`. */
export function moderationPolicy(rules: readonly TeamRule[]) {
  return defineModerationPolicy<ContentKind>({
    /** A person's `@username`. Masked names show their stand-in name. */
    username: {
      checks: [
        unicodeSafety,
        inHouseBlocklist,
        englishProfanity,
        reservedNameCheck,
        teamRulesCheck(rules, 'username'),
      ],
      mask: { kind: 'alias', alias: (subject) => moderationAlias(subject.id) },
    },
    /** A space's custom name. Masked names fall back to the default title. */
    spaceTitle: {
      checks: [
        unicodeSafety,
        links,
        inHouseBlocklist,
        englishProfanity,
        teamRulesCheck(rules, 'spaceTitle'),
      ],
      mask: { kind: 'hide' },
    },
  });
}

/** The moderation an app runs with: the policy bound to its caches. */
export type AppModeration = Moderator<ContentKind>;

/** Moderation under the team's `rules` (memoized verdicts, one per rule set). */
export function createAppModeration(rules: readonly TeamRule[]): AppModeration {
  return createModerator(moderationPolicy(rules));
}
