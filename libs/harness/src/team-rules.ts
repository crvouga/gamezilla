/**
 * The team's moderation rules for one simulated deployment. The rules ship
 * with the app, so a change reaches every device and every API instance at
 * once, connected or not — as a release carrying new rules would. Each world
 * holds its own; nothing is shared between harnesses.
 */

import type { ModerationRules } from '@libs/moderation-shared/moderation-rules';
import { moderationRulesOver } from '@libs/moderation-shared/moderation-rules';
import type { ContentKind, TeamRule } from '@libs/moderation-shared/policy';
import {
  SHIPPED_TEAM_RULES,
  teamRuleKey,
} from '@libs/moderation-shared/policy';
import type { Clock } from '@pkgs/clock-shared/types';

export type HarnessTeamRules = {
  /** What every device and API instance of this deployment runs with. */
  readonly moderation: ModerationRules;
  /** The team stops allowing `name` as content of `kind`, from now on. */
  stopAllowing(kind: ContentKind, name: string): void;
  /** The team starts allowing `name` as content of `kind` again. */
  startAllowing(kind: ContentKind, name: string): void;
};

export function createHarnessTeamRules(clock: Clock): HarnessTeamRules {
  let rules: readonly TeamRule[] = SHIPPED_TEAM_RULES;
  const listeners = new Set<() => void>();
  const announce = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const same = (rule: TeamRule, kind: ContentKind, name: string): boolean =>
    rule.kind === kind && teamRuleKey(rule.name) === teamRuleKey(name);
  return {
    moderation: moderationRulesOver({
      rules: () => rules,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    }),
    stopAllowing(kind, name) {
      if (rules.some((rule) => same(rule, kind, name))) return;
      rules = [...rules, { kind, name, sinceMs: clock.now() }];
      announce();
    },
    startAllowing(kind, name) {
      const kept = rules.filter((rule) => !same(rule, kind, name));
      if (kept.length === rules.length) return;
      rules = kept;
      announce();
    },
  };
}
