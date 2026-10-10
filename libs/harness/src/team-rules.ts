/**
 * The team's moderation rules for one simulated deployment. The rules ship
 * with the app. Connected devices receive a simulated release; disconnected
 * devices keep their installed rules until they reconnect. Each world holds
 * its own; nothing is shared between harnesses.
 */

import type { ModerationRules } from '@libs/moderation-shared/moderation-rules';
import { moderationRulesOver } from '@libs/moderation-shared/moderation-rules';
import type { ContentKind, TeamRule } from '@libs/moderation-shared/policy';
import {
  SHIPPED_TEAM_RULES,
  teamRuleKey,
} from '@libs/moderation-shared/policy';
import type { Clock } from '@pkgs/clock-shared/types';
import { deviceTeamRules } from './device-team-rules';

export type HarnessTeamRules = {
  /** The latest release's rules, used by API instances. */
  readonly moderation: ModerationRules;
  forDevice(args: {
    readonly reachable: () => boolean;
    readonly subscribeReachability: (listener: () => void) => () => void;
  }): ModerationRules;
  dispose(): void;
  /** The team stops allowing `name` as content of `kind`, from now on. */
  stopAllowing(kind: ContentKind, name: string): void;
  /** The team starts allowing `name` as content of `kind` again. */
  startAllowing(kind: ContentKind, name: string): void;
};

export function createHarnessTeamRules(clock: Clock): HarnessTeamRules {
  let rules: readonly TeamRule[] = SHIPPED_TEAM_RULES;
  const listeners = new Set<() => void>();
  const devices = new Set<() => void>();
  const announce = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const same = (rule: TeamRule, kind: ContentKind, name: string): boolean =>
    rule.kind === kind && teamRuleKey(rule.name) === teamRuleKey(name);
  const source = {
    rules: () => rules,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    moderation: moderationRulesOver(source),
    forDevice(args) {
      const device = deviceTeamRules({ ...args, source });
      devices.add(device.dispose);
      return device.moderation;
    },
    dispose() {
      for (const stop of devices) stop();
      devices.clear();
    },
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
