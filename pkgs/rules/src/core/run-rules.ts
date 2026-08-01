import { throwRulesReject } from './rules-reject';
import type { Failure, Rule, RulesAuth, RulesCtx } from './types';

function ruleMatchesBatch<TAuth extends RulesAuth>(
  rule: Rule<TAuth>,
  ctx: RulesCtx<TAuth>
): boolean {
  if (rule.phase !== ctx.phase) {
    return false;
  }
  if (rule.touches.length === 0) {
    return true;
  }
  return ctx.batch.rows.some((row) => rule.touches.includes(row.table));
}

export async function runRules<TAuth extends RulesAuth>(
  ctx: RulesCtx<TAuth>,
  rules: readonly Rule<TAuth>[]
): Promise<void> {
  const failures: Failure[] = [];

  for (const rule of rules) {
    if (!ruleMatchesBatch(rule, ctx)) {
      continue;
    }
    const ruleFailures = await rule.check(ctx);
    failures.push(...ruleFailures);
  }

  if (failures.length > 0) {
    throwRulesReject(failures);
  }
}
