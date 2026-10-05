import { predicateCheck } from '@pkgs/moderation-shared/check';
import { linkCheck } from '@pkgs/moderation-shared/link-check';
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
 * shown. The same declaration is enforced at every level:
 *
 * 1. As a person types — forms call `moderation.checkWrite` (static, sync).
 * 2. In mutations — the same call refuses the write on the client's
 *    optimistic apply and again on the server's authoritative replay.
 * 3. On every display — `moderation.display` judges stored text by the policy
 *    as it is *now*, so a new or stricter check masks old names at once and a
 *    loosened one unmasks them. Stored text is never rewritten: no backfill,
 *    no data loss, fully reversible.
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

export const moderationPolicy = defineModerationPolicy({
  /** A person's `@username`. Masked names show a stable alias. */
  username: {
    checks: [
      unicodeSafety,
      inHouseBlocklist,
      englishProfanity,
      reservedNameCheck,
    ],
    mask: { kind: 'alias', alias: (subject) => moderationAlias(subject.id) },
  },
  /** A space's custom name. Masked names fall back to the default title. */
  spaceTitle: {
    checks: [unicodeSafety, links, inHouseBlocklist, englishProfanity],
    mask: { kind: 'hide' },
  },
});

export type ContentKind = keyof typeof moderationPolicy.kinds;

/** Process-wide moderator: memoized verdicts shared by every caller. */
export const moderation = createModerator(moderationPolicy);
