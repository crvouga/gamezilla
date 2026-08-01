import type { Rule, RulesAuth } from './types';

export function defineRule<TAuth extends RulesAuth = RulesAuth>(
  rule: Rule<TAuth>
): Rule<TAuth> {
  return rule;
}
