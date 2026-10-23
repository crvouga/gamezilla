import type {
  ModerationRules,
  TeamRuleSource,
} from '@libs/moderation-shared-ts/moderation-rules';
import { moderationRulesOver } from '@libs/moderation-shared-ts/moderation-rules';

/** A release cannot install new naming rules on a disconnected device. */
export function deviceTeamRules(args: {
  readonly source: TeamRuleSource;
  readonly reachable: () => boolean;
  readonly subscribeReachability: (listener: () => void) => () => void;
}): { readonly moderation: ModerationRules; readonly dispose: () => void } {
  let installed = args.source.rules();
  const listeners = new Set<() => void>();
  const install = (): void => {
    if (!args.reachable()) return;
    const latest = args.source.rules();
    if (latest === installed) return;
    installed = latest;
    for (const listener of [...listeners]) listener();
  };
  const stopRules = args.source.subscribe(install);
  const stopNetwork = args.subscribeReachability(install);
  return {
    moderation: moderationRulesOver({
      rules: () => installed,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
    dispose: () => {
      stopRules();
      stopNetwork();
      listeners.clear();
    },
  };
}
