// @io-wall-ok — OpenTofu CLI composition for restoring an archived Grafana instance.
import {
  grafanaRestoreAccountArgs,
  grafanaRestoreAccountDenials,
  grafanaRestoreEnv,
} from '@libs/infra-shared-ts/grafana-restore';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import { evaluatePlanPolicy } from '@libs/infra-shared-ts/plan-policy';
import { redactInfraOutput } from '@libs/infra-shared-ts/redact-output';
import type { Target, TofuPaths } from '@libs/infra-shared-ts/tofu-command';
import { applyArgs, showArgs } from '@libs/infra-shared-ts/tofu-command';
import { backupState } from './state-backup';
import { conftest, fail, spawnTool, tofu } from './tofu-process';

/**
 * The account pass: import the account Grafana kept and give it a new
 * token, so the views pass can read what else was kept. Returns the
 * environment the views pass plans with.
 */
export async function adoptKeptGrafanaAccount(input: {
  paths: TofuPaths;
  target: Target;
  env: Record<string, string>;
  policyDir: string;
  lock: boolean;
}): Promise<Record<string, string>> {
  const { paths, target } = input;
  const env = grafanaRestoreEnv(input.env, 'account');
  console.log(
    '[infra] Grafana is back from archive: adopting the observability account it kept'
  );
  const planned = spawnTool(
    'tofu',
    grafanaRestoreAccountArgs(paths, target, { lock: input.lock }),
    { env, capture: true }
  );
  console.log(
    redactInfraOutput(`${planned.stdout}${planned.stderr}`, {
      ...process.env,
      ...env,
    })
  );
  if (![0, 2].includes(planned.status))
    fail('Grafana restore: account plan failed');
  const shown = spawnTool('tofu', showArgs(paths, target), {
    env,
    capture: true,
  });
  if (shown.status !== 0) fail('Grafana restore: tofu show failed');
  const plan = JSON.parse(shown.stdout) as PlanJson;
  const denials = [
    ...grafanaRestoreAccountDenials(plan),
    ...evaluatePlanPolicy(plan, input.policyDir, conftest).denials,
  ];
  if (denials.length > 0) fail(denials.join('\n'));
  await backupState({ target, env });
  if (tofu(applyArgs(paths, target), env) !== 0)
    fail('Grafana restore: account apply failed');
  return grafanaRestoreEnv(input.env, 'views');
}
