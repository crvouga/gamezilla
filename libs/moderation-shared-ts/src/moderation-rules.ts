import { Lru } from '@pkgs/moderation-shared-ts/lru';

import type { AppModeration, TeamRule } from './policy';
import { createAppModeration, SHIPPED_TEAM_RULES, teamRuleKey } from './policy';

/**
 * The moderation an app (a device or an API instance) runs with, as the
 * team's rules stand. Composition roots inject it (`ClientEnv.moderation`,
 * `ServerEnv.moderation`); nothing reads a process-wide policy.
 */
export type ModerationRules = {
  /** What every screen and form judges names by: the rules as they stand. */
  readonly current: () => AppModeration;
  /**
   * What a write made at `atMs` is judged by: a name given before the team
   * stopped allowing it (queued offline) is kept, like every name saved then.
   */
  readonly at: (atMs: number) => AppModeration;
  /** Called whenever the rules change; every screen re-judges its names. */
  readonly subscribe: (listener: () => void) => () => void;
};

/** Where the team's rules come from, and how a change is announced. */
export type TeamRuleSource = {
  readonly rules: () => readonly TeamRule[];
  readonly subscribe: (listener: () => void) => () => void;
};

const MODERATIONS_KEPT = 16;

function ruleSetKey(rules: readonly TeamRule[]): string {
  return rules
    .map((rule) => `${rule.kind}\u0000${teamRuleKey(rule.name)}`)
    .sort()
    .join('\u0001');
}

/** Moderation over `source`: one memoized moderator per distinct rule set. */
export function moderationRulesOver(source: TeamRuleSource): ModerationRules {
  const moderations = new Lru<AppModeration>(MODERATIONS_KEPT);
  const forRules = (rules: readonly TeamRule[]): AppModeration => {
    const key = ruleSetKey(rules);
    const cached = moderations.get(key);
    if (cached !== undefined) return cached;
    const moderation = createAppModeration(rules);
    moderations.set(key, moderation);
    return moderation;
  };
  return {
    current: () => forRules(source.rules()),
    at: (atMs) =>
      forRules(source.rules().filter((rule) => rule.sinceMs <= atMs)),
    subscribe: source.subscribe,
  };
}

/** The rules this build ships with; they change only with a new build. */
export function shippedModerationRules(): ModerationRules {
  return moderationRulesOver({
    rules: () => SHIPPED_TEAM_RULES,
    subscribe: () => () => undefined,
  });
}
