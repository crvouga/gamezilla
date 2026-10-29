#!/usr/bin/env bun
// @io-wall-ok — CLI entry: spawns tofu / conftest, reads the env file.
/**
 * The one way OpenTofu runs in this repo.
 *
 *   bun run scripts/tofu.ts plan  --stack foundation   # read-only
 *   bun run scripts/tofu.ts apply --stack foundation   # plan → policy → apply
 *   bun run scripts/tofu.ts drift --stack edge         # fails on any change
 *   bun run scripts/tofu.ts apply --stack bootstrap    # global; run by a person
 *   bun run scripts/tofu.ts apply --stack fleet        # global; Release runs it
 *   bun run scripts/tofu.ts destroy --stack edge       # teardown (infra:destroy)
 *   bun run scripts/tofu.ts destroy --stack fleet --env <env>
 *
 * `foundation` / `edge` run for the environment in `SECRETS_ENV` (whose
 * secrets `secrets-run` injected). Every run first writes the resolved var
 * files (`tofu-var-files.ts`) OpenTofu reads. Every apply:
 *
 *   1. plans to a file,
 *   2. refuses the plan if `policy/stateful.rego` denies it (deleting or
 *      replacing anything that may hold data, or a production mass delete),
 *   3. copies the current encrypted state object aside,
 *   4. applies exactly that saved plan.
 *
 * `destroy` is the same path with a destroy plan, run only by
 * `scripts/destroy-env.ts` (`bun run infra:destroy`): the policy is told the
 * environment's protection, so a standard environment tears down completely
 * and a production one is refused. Nothing ever applies without a plan.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';
import {
  ciIdentityRecoveryDenials,
  ciIdentityRecoveryEnvironment,
  ciIdentityRecoveryPlanArgs,
  validateCiIdentityRecovery,
} from '@libs/infra-shared-ts/ci-identity-recovery';
import { envFile } from '@libs/infra-shared-ts/envs';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import { evaluatePlanPolicy } from '@libs/infra-shared-ts/plan-policy';
import {
  planReadFailed,
  providerFailureIsTransient,
} from '@libs/infra-shared-ts/plan-retry';
import { redactInfraOutput } from '@libs/infra-shared-ts/redact-output';
import type { Stack, Target } from '@libs/infra-shared-ts/tofu-command';
import {
  applyArgs,
  destroyPlanArgs,
  fleetEnvResources,
  GLOBAL_STACKS,
  initArgs,
  missingSecretsMessage,
  planArgs,
  STACKS,
  showArgs,
  stateBackendExists,
  tofuEnvironment,
} from '@libs/infra-shared-ts/tofu-command';
import { resolveAwsSession } from './aws-session';
import {
  dropLocalBackend,
  hasUnmigratedLocalState,
  migrateToBucket,
  useLocalBackend,
} from './bootstrap-backend';
import { resolveInfisicalToken } from './infisical-token';
import { infraOperation } from './infra-operation';
import { backupState } from './state-backup';
import { conftest, fail, spawnTool, tofu } from './tofu-process';
import { writeResolvedVarFiles } from './tofu-var-files';

type Command = 'plan' | 'apply' | 'drift' | 'destroy';

const COMMANDS: readonly Command[] = ['plan', 'apply', 'drift', 'destroy'];

type Teardown = PlanJson['teardown'];

const PKG_DIR = join(import.meta.dirname, '..');
const { paths: PATHS, policyDir: POLICY_DIR } = tofuLayout(PKG_DIR);

type Cli = {
  readonly command: Command;
  readonly stack: Stack;
  /** `destroy --stack fleet` only: the environment whose entries go. */
  readonly env: string | null;
  readonly recoverCiIdentity: boolean;
};

function flag(argv: readonly string[], name: string): string | null {
  const at = argv.indexOf(name);
  return at < 0 ? null : (argv[at + 1] ?? null);
}

function parseCli(argv: readonly string[]): Cli {
  const command = argv[0] as Command;
  if (!COMMANDS.includes(command)) {
    fail(
      `usage: tofu.ts <${COMMANDS.join('|')}> --stack <${STACKS.join('|')}> [--env <env>]`
    );
  }
  const stack = flag(argv, '--stack') as Stack;
  if (!STACKS.includes(stack))
    fail(`--stack must be one of ${STACKS.join(', ')}`);
  const recoverCiIdentity = argv.includes('--recover-ci-identity');
  if (recoverCiIdentity) validateCiIdentityRecovery(command, stack);
  return { command, stack, env: flag(argv, '--env'), recoverCiIdentity };
}

function targetFor(stack: Stack): Target {
  if (GLOBAL_STACKS.includes(stack)) return { stack, env: null };
  const env = (process.env['SECRETS_ENV'] ?? '').trim();
  if (env.length === 0)
    fail('SECRETS_ENV is required (run through secrets-run)');
  envFile(env); // throws for an environment with no tofu/envs file
  return { stack, env };
}

async function toolEnvironment(
  target: Target,
  cli: Cli
): Promise<Record<string, string>> {
  const label = `${target.stack}/${target.env ?? 'global'}`;
  const aws = cli.recoverCiIdentity
    ? null
    : await infraOperation(`${label}: AWS credentials`, (signal) =>
        resolveAwsSession(process.env, target.stack, signal)
      );
  const { env, missing } = cli.recoverCiIdentity
    ? ciIdentityRecoveryEnvironment(process.env, PATHS)
    : tofuEnvironment(process.env, PATHS, target, aws);
  if (missing.length > 0) fail(missingSecretsMessage(target.stack, missing));
  if (target.stack === 'edge') return { ...env };
  return {
    ...env,
    TF_VAR_infisical_token: await infraOperation(
      `${label}: Infisical credentials`,
      () => resolveInfisicalToken()
    ),
  };
}

/** What a destroy plan covers: the whole stack, or one env's fleet entries. */
function teardownScope(target: Target, cli: Cli): readonly string[] {
  if (target.stack !== 'fleet') return [];
  if (cli.env === null) fail('destroy --stack fleet needs --env <env>');
  return fleetEnvResources(cli.env);
}

const PLAN_ATTEMPTS = 3;
/** A dropped provider connection is often up again a moment later. */
const PLAN_RETRY_WAIT_MS = 1_000;

/** Plans to a file and returns the tofu exit code (0 no-op, 2 changes). */
async function planTarget(
  target: Target,
  env: Record<string, string>,
  cli: Cli
): Promise<number> {
  if (tofu(initArgs(PATHS, target), env) !== 0)
    fail(`${target.stack}: tofu init failed`);
  const args =
    cli.command === 'destroy'
      ? destroyPlanArgs(PATHS, target, teardownScope(target, cli))
      : cli.recoverCiIdentity
        ? ciIdentityRecoveryPlanArgs(PATHS)
        : planArgs(PATHS, target);
  for (let attempt = 1; attempt <= PLAN_ATTEMPTS; attempt += 1) {
    const result = spawnTool('tofu', args, { env, capture: true });
    const output = redactInfraOutput(`${result.stdout}${result.stderr}`, {
      ...process.env,
      ...env,
    });
    if (output.length > 0) {
      process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
    }
    if (!planReadFailed(result.status)) return result.status;
    const retry = providerFailureIsTransient(output) && attempt < PLAN_ATTEMPTS;
    if (!retry) break;
    console.error(
      `[infra] ${target.stack}: plan read failed, retrying (${String(attempt)})`
    );
    await Bun.sleep(PLAN_RETRY_WAIT_MS);
  }
  fail(`${target.stack}: tofu plan failed`);
}

function checkPolicy(
  target: Target,
  env: Record<string, string>,
  teardown: Teardown,
  recoverCiIdentity: boolean
): void {
  const shown = spawnTool('tofu', showArgs(PATHS, target), {
    env,
    capture: true,
  });
  if (shown.status !== 0)
    fail(`${target.stack}: tofu show failed: ${shown.stderr}`);
  const plan = JSON.parse(shown.stdout) as PlanJson;
  const verdict = evaluatePlanPolicy(
    teardown === undefined ? plan : { ...plan, teardown },
    POLICY_DIR,
    conftest
  );
  const denials = [
    ...verdict.denials,
    ...(recoverCiIdentity ? ciIdentityRecoveryDenials(plan) : []),
  ];
  if (denials.length > 0) {
    for (const denial of denials) console.error(`  ✗ ${denial}`);
    fail(
      `${target.stack}: plan refused by policy/stateful.rego — nothing was applied`
    );
  }
  console.log(`[infra] ${target.stack}: plan passed policy/stateful.rego`);
}

/** The torn-down environment's protection, told to the policy. */
function teardownOf(target: Target, cli: Cli): Teardown {
  if (cli.command !== 'destroy') return undefined;
  if (target.stack === 'bootstrap')
    fail('the bootstrap stack is never destroyed');
  const name = target.env ?? cli.env;
  if (name === null) fail('destroy needs an environment');
  return { protection: envFile(name).protection };
}

const APPLY_ATTEMPTS = 3;
/** A provider API that timed out is often still finishing the call. */
const APPLY_RETRY_WAIT_MS = 30_000;

/**
 * Plan, policy, backup, apply. An apply that fails on a transient provider
 * error returns `retry`: the saved plan is stale once part of it ran, so the
 * caller plans again against what the failed call left behind.
 */
async function runOnce(
  cli: Cli,
  target: Target,
  firstRun: boolean
): Promise<'done' | 'retry'> {
  const { command } = cli;
  const env = await toolEnvironment(target, cli);
  const label = `${target.stack}/${target.env ?? cli.env ?? 'global'}`;
  const teardown = teardownOf(target, cli);
  const status = await planTarget(target, env, cli);
  checkPolicy(target, env, teardown, cli.recoverCiIdentity);
  if (status === 0) {
    console.log(`[infra] ${label}: no changes`);
    return 'done';
  }
  if (command === 'drift')
    fail(
      `${label}: live infrastructure drifted from libs/infra-shared-ts/tofu`
    );
  if (command === 'plan') return 'done';

  if (!firstRun) await backupState({ target, env });
  const result = spawnTool('tofu', applyArgs(PATHS, target), { env });
  const applied = result.status === 0;
  // A partial first-run apply still created things; its state must reach the
  // bucket (or stay local for the next run) before this process exits.
  if (firstRun) await migrateToBucket(PATHS, target, env);
  if (applied) {
    console.log(`[infra] ${label}: applied`);
    return 'done';
  }
  if (
    !firstRun &&
    providerFailureIsTransient(`${result.stdout}${result.stderr}`)
  )
    return 'retry';
  fail(`${label}: tofu apply failed`);
}

async function run(cli: Cli, target: Target, firstRun: boolean): Promise<void> {
  for (let attempt = 1; attempt <= APPLY_ATTEMPTS; attempt += 1) {
    if ((await runOnce(cli, target, firstRun)) === 'done') return;
    if (attempt < APPLY_ATTEMPTS) {
      console.error(
        `[infra] ${target.stack}: apply hit a transient provider error, planning again (${String(attempt)})`
      );
      await Bun.sleep(APPLY_RETRY_WAIT_MS);
    }
  }
  fail(
    `${target.stack}: tofu apply failed after ${String(APPLY_ATTEMPTS)} attempts`
  );
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const { command, stack } = cli;
  const target = targetFor(stack);
  // TF_PLUGIN_CACHE_DIR must exist; a fresh CI checkout has no .cache.
  mkdirSync(join(PATHS.cacheDir, 'plugins'), { recursive: true });
  writeResolvedVarFiles(PATHS);
  const firstRun =
    stack === 'bootstrap' &&
    (hasUnmigratedLocalState(PATHS) || !stateBackendExists(process.env));
  if (cli.recoverCiIdentity && firstRun)
    fail('CI identity recovery requires the existing encrypted remote state');
  if (!firstRun) return run(cli, target, false);

  console.log(
    '[infra] bootstrap: first run (or resuming one) — using the local backend'
  );
  useLocalBackend(PATHS);
  // `fail` exits the process, which skips `finally`: a stray override would
  // point a later run at local state, so it is removed on every exit.
  process.on('exit', () => dropLocalBackend(PATHS));
  await run(cli, target, command === 'apply');
}

await main();
