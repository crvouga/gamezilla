// @io-wall-ok — OpenTofu CLI composition for a state-only retirement.
import {
  grafanaRetirementArgs,
  grafanaRetirementDenials,
  hasGrafanaRetirement,
} from '@libs/infra-shared-ts/grafana-retirement';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import { evaluatePlanPolicy } from '@libs/infra-shared-ts/plan-policy';
import type { Target, TofuPaths } from '@libs/infra-shared-ts/tofu-command';
import {
  applyArgs,
  initArgs,
  showArgs,
} from '@libs/infra-shared-ts/tofu-command';
import { backupState } from './state-backup';
import { conftest, fail, spawnTool, tofu, tofuInit } from './tofu-process';

/**
 * Plans only the Grafana scope, without refresh: an archived instance cannot
 * answer a refresh, and an instance back from archive may hold views the
 * current token cannot read until the restore runs. Read before every
 * fully refreshed foundation plan, for retirement and for restore.
 */
export async function planGrafanaScope(input: {
  paths: TofuPaths;
  target: Target;
  env: Record<string, string>;
  /** false for read-only preview/drift so a killed runner cannot abandon state. */
  lock: boolean;
}): Promise<PlanJson> {
  const { paths, target, env } = input;
  if ((await tofuInit(initArgs(paths, target), env)) !== 0)
    fail('Grafana scope: tofu init failed');
  const planned = spawnTool(
    'tofu',
    grafanaRetirementArgs(paths, target, { lock: input.lock }),
    {
      env,
      capture: true,
    }
  );
  if (![0, 2].includes(planned.status))
    fail(`Grafana scope: plan failed: ${planned.stderr}`);
  const shown = spawnTool('tofu', showArgs(paths, target), {
    env,
    capture: true,
  });
  if (shown.status !== 0) fail('Grafana scope: tofu show failed');
  return JSON.parse(shown.stdout) as PlanJson;
}

/**
 * count=0 still refreshes archived Grafana objects, even with destroy=false.
 * Apply only a pure forget of the scope plan (`planGrafanaScope`).
 * Active/new instances continue through the ordinary fully refreshed plan.
 * A preview stops at retirement: its ordinary plan needs that state applied.
 */
export async function retireArchivedGrafana(input: {
  paths: TofuPaths;
  target: Target;
  env: Record<string, string>;
  policyDir: string;
  preview: boolean;
  /** The saved scope plan; it is the one applied. */
  plan: PlanJson;
}): Promise<boolean> {
  const { paths, target, env, plan } = input;
  if (!hasGrafanaRetirement(plan)) return false;
  const denials = [
    ...grafanaRetirementDenials(plan),
    ...evaluatePlanPolicy(plan, input.policyDir, conftest).denials,
  ];
  if (denials.length > 0) fail(denials.join('\n'));
  console.log(
    '[infra] archived Grafana: state-only retirement; remote objects preserved'
  );
  if (input.preview) {
    console.log(
      '[infra] preview: fully refreshed foundation plan follows retirement on apply'
    );
    return true;
  }
  await backupState({ target, env });
  if (tofu(applyArgs(paths, target), env) !== 0)
    fail('Grafana retirement: apply failed');
  return false;
}
