import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { IndexPlan, WorkloadManifest } from './types';

/**
 * Human-readable plan summary for CI comments.
 */
export function renderPlanMarkdown(
  plan: IndexPlan,
  manifest: WorkloadManifest
): string {
  assert.ok(plan !== undefined, 'plan required');
  assert.ok(manifest !== undefined, 'manifest required');
  const lines: string[] = [];
  lines.push('# Index plan');
  lines.push('');
  lines.push(
    `Queries: **${String(manifest.queries.length)}** · Desired indexes: **${String(plan.desired.length)}** · Actions: **${String(plan.actions.length)}**`
  );
  lines.push('');
  if (plan.desired.length > 0) {
    lines.push('## Desired');
    for (let i = 0; i < plan.desired.length; i++) {
      const d = plan.desired[i]!;
      const cols = d.definition.columns.map((c) => c.name).join(', ');
      const incl =
        d.definition.include.length > 0
          ? ` INCLUDE (${d.definition.include.join(', ')})`
          : '';
      const pred = d.definition.predicate
        ? ` WHERE ${d.definition.predicate}`
        : '';
      lines.push(
        `- \`${d.name}\` on \`${d.definition.table}\` (${cols})${incl}${pred}`
      );
    }
    lines.push('');
  }
  if (plan.actions.length > 0) {
    lines.push('## Actions');
    for (let i = 0; i < plan.actions.length; i++) {
      const a = plan.actions[i]!;
      lines.push(`- **${a.kind}** \`${a.name}\` (${a.table})`);
    }
    lines.push('');
  }
  if (plan.skipped.length > 0) {
    lines.push('## Skipped');
    const max = Math.min(plan.skipped.length, 50);
    for (let i = 0; i < max; i++) {
      const s = plan.skipped[i]!;
      lines.push(`- \`${s.reason}\`: ${s.detail}`);
    }
    if (plan.skipped.length > max) {
      lines.push(`- …and ${String(plan.skipped.length - max)} more`);
    }
  }
  assert.ok(lines.length > 0, 'markdown non-empty');
  return lines.join('\n');
}
