#!/usr/bin/env bun
// @io-wall-ok — CLI entry: spawns tofu / conftest, reads the env file.
/**
 * The one way OpenTofu runs in this repo.
 *
 *   bun run scripts/tofu.ts plan  --stack foundation   # read-only
 *   bun run scripts/tofu.ts apply --stack foundation   # plan → policy → apply
 *   bun run scripts/tofu.ts drift --stack edge         # fails on any change
 *   bun run scripts/tofu.ts apply --stack bootstrap    # global; run by a person
 *   bun run scripts/tofu.ts apply --stack fleet        # global; Deploy runs it
 *   bun run scripts/tofu.ts destroy --stack edge       # teardown (infra:destroy)
 *   bun run scripts/tofu.ts destroy --stack fleet --env <env>
 *
 * `foundation` / `edge` run for the environment in `SECRETS_ENV` (whose
 * secrets `secrets-run` injected). Every apply:
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
import { envFile } from '@libs/infra/public/envs';
import {
  evaluatePlanPolicy,
  type PlanJson,
} from '@libs/infra/public/plan-policy';
import {
  applyArgs,
  destroyPlanArgs,
  fleetEnvResources,
  GLOBAL_STACKS,
  initArgs,
  planArgs,
  STACKS,
  type Stack,
  showArgs,
  stateBackendExists,
  type Target,
  type TofuPaths,
  tofuEnvironment,
} from '@libs/infra/public/tofu-command';
import {
  dropLocalBackend,
  hasUnmigratedLocalState,
  migrateToBucket,
  useLocalBackend,
} from './bootstrap-backend';
import { resolveInfisicalToken } from './infisical-token';
import { backupState } from './state-backup';
import { conftest, fail, spawnTool, tofu } from './tofu-process';

type Command = 'plan' | 'apply' | 'drift' | 'destroy';

const COMMANDS: readonly Command[] = ['plan', 'apply', 'drift', 'destroy'];

type Teardown = PlanJson['teardown'];

const PKG_DIR = join(import.meta.dirname, '..');
const PATHS: TofuPaths = {
  tofuDir: join(PKG_DIR, 'tofu'),
  cacheDir: join(PKG_DIR, '.cache/tofu'),
};
const POLICY_DIR = join(PKG_DIR, 'policy');

type Cli = {
  readonly command: Command;
  readonly stack: Stack;
  /** `destroy --stack fleet` only: the environment whose entries go. */
  readonly env: string | null;
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
  return { command, stack, env: flag(argv, '--env') };
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
  target: Target
): Promise<Record<string, string>> {
  const { env, missing } = tofuEnvironment(process.env, PATHS, target);
  if (missing.length > 0) {
    const hint = missing.some((m) => m.startsWith('TOFU_STATE_ACCESS'))
      ? 'run `bun run infra:bootstrap` first'
      : 'bun run secrets:seed';
    fail(
      `missing secrets for the ${target.stack} stack: ${missing.join(', ')} (${hint})`
    );
  }
  if (target.stack === 'edge') return { ...env };
  return { ...env, TF_VAR_infisical_token: await resolveInfisicalToken() };
}

/** What a destroy plan covers: the whole stack, or one env's fleet entries. */
function teardownScope(target: Target, cli: Cli): readonly string[] {
  if (target.stack !== 'fleet') return [];
  if (cli.env === null) fail('destroy --stack fleet needs --env <env>');
  return fleetEnvResources(cli.env);
}

/** Plans to a file and returns the tofu exit code (0 no-op, 2 changes). */
function planTarget(
  target: Target,
  env: Record<string, string>,
  cli: Cli
): number {
  if (tofu(initArgs(PATHS, target), env) !== 0)
    fail(`${target.stack}: tofu init failed`);
  const args =
    cli.command === 'destroy'
      ? destroyPlanArgs(PATHS, target, teardownScope(target, cli))
      : planArgs(PATHS, target);
  const status = tofu(args, env);
  if (status !== 0 && status !== 2) fail(`${target.stack}: tofu plan failed`);
  return status;
}

function checkPolicy(
  target: Target,
  env: Record<string, string>,
  teardown: Teardown
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
  if (!verdict.allowed) {
    for (const denial of verdict.denials) console.error(`  ✗ ${denial}`);
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

async function run(cli: Cli, target: Target, firstRun: boolean): Promise<void> {
  const { command } = cli;
  const env = await toolEnvironment(target);
  const label = `${target.stack}/${target.env ?? cli.env ?? 'global'}`;
  const teardown = teardownOf(target, cli);
  const status = planTarget(target, env, cli);
  checkPolicy(target, env, teardown);
  if (status === 0) {
    console.log(`[infra] ${label}: no changes`);
    return;
  }
  if (command === 'drift')
    fail(`${label}: live infrastructure drifted from libs/infra/tofu`);
  if (command === 'plan') return;

  if (!firstRun) await backupState({ target, env });
  const applied = tofu(applyArgs(PATHS, target), env) === 0;
  // A partial first-run apply still created things; its state must reach the
  // bucket (or stay local for the next run) before this process exits.
  if (firstRun) await migrateToBucket(PATHS, target, env);
  if (!applied) fail(`${label}: tofu apply failed`);
  console.log(`[infra] ${label}: applied`);
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const { command, stack } = cli;
  const target = targetFor(stack);
  // TF_PLUGIN_CACHE_DIR must exist; a fresh CI checkout has no .cache.
  mkdirSync(join(PATHS.cacheDir, 'plugins'), { recursive: true });
  const firstRun =
    stack === 'bootstrap' &&
    (hasUnmigratedLocalState(PATHS) || !stateBackendExists(process.env));
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
