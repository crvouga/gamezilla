// @io-wall-ok — OpenTofu CLI composition for restoring an archived Grafana instance.
import type { GrafanaRestore } from '@libs/infra-shared-ts/grafana-restore';
import {
  grafanaRestoreAccountArgs,
  grafanaRestoreAccountDenials,
  grafanaRestoreEnv,
  grafanaUntaintArgs,
} from '@libs/infra-shared-ts/grafana-restore';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import { evaluatePlanPolicy } from '@libs/infra-shared-ts/plan-policy';
import { redactInfraOutput } from '@libs/infra-shared-ts/redact-output';
import type { Target, TofuPaths } from '@libs/infra-shared-ts/tofu-command';
import { applyArgs, showArgs } from '@libs/infra-shared-ts/tofu-command';
import { backupState } from './state-backup';
import { conftest, fail, spawnTool, tofu } from './tofu-process';

/**
 * Restores the Grafana scope before the fully refreshed plan: untaint views
 * Grafana created but could not read back, adopt or create the account, and
 * return the environment the next plan runs with (the views pass when any
 * view is missing from state).
 */
export async function restoreGrafana(input: {
  paths: TofuPaths;
  target: Target;
  env: Record<string, string>;
  policyDir: string;
  lock: boolean;
  restore: GrafanaRestore;
}): Promise<Record<string, string>> {
  const { paths, target, restore } = input;
  if (restore.untaint.length > 0) {
    console.log(
      `[infra] Grafana created views it could not read back; keeping them: ${restore.untaint.join(', ')}`
    );
    await backupState({ target, env: input.env });
    for (const address of restore.untaint)
      if (tofu(grafanaUntaintArgs(paths, target, address), input.env) !== 0)
        fail(`Grafana restore: untaint ${address} failed`);
  }
  if (restore.account) await adoptKeptGrafanaAccount(input);
  if (restore.adopt.length === 0) return input.env;
  console.log(
    `[infra] Grafana views missing from state: adopting any Grafana kept (${String(restore.adopt.length)})`
  );
  return grafanaRestoreEnv(input.env, 'views', restore.adopt);
}

/**
 * The account pass: import the account Grafana kept and give it a new
 * token, so the views pass can read what else was kept.
 */
async function adoptKeptGrafanaAccount(input: {
  paths: TofuPaths;
  target: Target;
  env: Record<string, string>;
  policyDir: string;
  lock: boolean;
}): Promise<void> {
  const { paths, target } = input;
  const env = grafanaRestoreEnv(input.env, 'account');
  console.log(
    '[infra] Grafana views account missing from state: adopting the one Grafana kept, or creating it'
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
}
