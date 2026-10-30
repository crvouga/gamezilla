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
import { conftest, fail, spawnTool, tofu } from './tofu-process';

/**
 * count=0 still refreshes archived Grafana objects, even with destroy=false.
 * Plan only those addresses without refresh, and apply only a pure forget.
 * Active/new instances continue through the ordinary fully refreshed plan.
 * A preview stops at retirement: its ordinary plan needs that state applied.
 */
export async function retireArchivedGrafana(input: {
  paths: TofuPaths;
  target: Target;
  env: Record<string, string>;
  policyDir: string;
  preview: boolean;
}): Promise<boolean> {
  const { paths, target, env } = input;
  if (tofu(initArgs(paths, target), env) !== 0)
    fail('Grafana retirement: tofu init failed');
  const planned = spawnTool('tofu', grafanaRetirementArgs(paths, target), {
    env,
    capture: true,
  });
  if (![0, 2].includes(planned.status))
    fail(`Grafana retirement: plan failed: ${planned.stderr}`);
  const shown = spawnTool('tofu', showArgs(paths, target), {
    env,
    capture: true,
  });
  if (shown.status !== 0) fail('Grafana retirement: tofu show failed');
  const plan = JSON.parse(shown.stdout) as PlanJson;
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
