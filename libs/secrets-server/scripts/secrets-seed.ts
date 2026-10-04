#!/usr/bin/env bun
/**
 * Interactively write manual (non-derivable) registry secrets to Infisical.
 *
 * Usage:
 *   bun run secrets:seed -- --env prd                    # prompt for every missing manual secret
 *   bun run secrets:seed -- --env prd GRAFANA_CLOUD_API_TOKEN
 *   bun run secrets:seed -- --env prd --force NAME       # overwrite an existing value
 *   printf %s "$TOKEN" | bun run secrets:seed -- --env prd NAME   # non-interactive
 *
 * Values are read with echo off and validated with the registry `validate`
 * before writing. Account-wide secrets (`secrets.json` `shared`) are written
 * to the shared environment every environment imports, whatever `--env` is. Secrets OpenTofu writes (`managedBy: 'tofu'`) are skipped
 * unless named explicitly. Run `bun run secrets:pull` afterwards to refresh
 * the offline cache.
 */
// @io-wall-ok — composition root (stdin TTY + Infisical admin CLI)
import type { EnvFile } from '@libs/infra-shared/env-file';
import { envFile } from '@libs/infra-shared/envs';
import { ok, warn } from '@libs/secrets-server/fmt';
import { SECRETS } from '@libs/secrets-server/registry';
import {
  exportSecretsMapLive,
  setSecretIn,
} from '@libs/secrets-server/secrets-io';
import type { Secret } from '@libs/secrets-shared/secret';
import { validateSecretOrError } from '@libs/secrets-shared/secret';
import {
  isSharedSecret,
  SHARED_SECRETS_ENV,
} from '@libs/secrets-shared/shared-secrets';

type SeedArgs = {
  readonly env: EnvFile;
  readonly force: boolean;
  readonly names: readonly string[];
};

function parseArgs(argv: readonly string[]): SeedArgs {
  let env = (process.env['SECRETS_ENV'] ?? 'dev').trim();
  let force = false;
  const names: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--force') force = true;
    else if (arg === '--env') env = argv[++i] ?? '';
    else if (arg.startsWith('--env=')) env = arg.slice('--env='.length);
    else if (arg !== '--') names.push(arg);
  }
  return { env: envFile(env), force, names };
}

function selectSecrets(
  args: SeedArgs,
  stored: ReadonlyMap<string, string>
): readonly Secret[] {
  if (args.names.length > 0) {
    return args.names.map((name) => {
      const secret = SECRETS.find((s) => s.name === name);
      if (secret === undefined) {
        throw new Error(`${name} is not in the secrets registry`);
      }
      return secret;
    });
  }
  return SECRETS.filter(
    (s) =>
      s.managedBy === null && (stored.get(s.name) ?? '').trim().length === 0
  );
}

async function readPipedValue(): Promise<string> {
  return (await Bun.stdin.text()).trim();
}

/** Read one line from the TTY with echo disabled. */
function readHiddenLine(label: string): Promise<string> {
  process.stdout.write(label);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  let value = '';
  return new Promise((resolve, reject) => {
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          finish();
          reject(new Error('aborted'));
          return;
        }
        if (ch === '\r' || ch === '\n') {
          finish();
          resolve(value.trim());
          return;
        }
        if (ch === '\u007f') value = value.slice(0, -1);
        else value += ch;
      }
    };
    const finish = (): void => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
    };
    stdin.on('data', onData);
  });
}

async function seedOne(
  secret: Secret,
  args: SeedArgs,
  stored: Map<string, string>
): Promise<boolean> {
  const present = (stored.get(secret.name) ?? '').trim().length > 0;
  if (present && !args.force) {
    ok(
      secret.name,
      `already set in ${args.env.env} (use --force to overwrite)`
    );
    return true;
  }
  if (secret.managedBy !== null) {
    warn(
      secret.name,
      'normally written by @libs/infra#apply:foundation (OpenTofu)'
    );
  }
  const interactive = process.stdin.isTTY === true;
  if (interactive) {
    console.log(`\n${secret.name} (${args.env.env})\n${secret.hint}`);
  }
  const value = interactive
    ? await readHiddenLine(`${secret.name} (empty to skip): `)
    : await readPipedValue();
  if (value.length === 0) {
    warn(secret.name, 'skipped');
    return true;
  }
  const err = await validateSecretOrError(secret, {
    env: args.env,
    secretValue: value,
    secrets: stored,
  });
  if (err !== null) {
    console.error(`${secret.name}: ${err} — not written`);
    return false;
  }
  const target = isSharedSecret(secret.name)
    ? SHARED_SECRETS_ENV
    : args.env.env;
  await setSecretIn(target, secret.name, value);
  stored.set(secret.name, value);
  ok(secret.name, `written to secrets env ${target}`);
  return true;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const stored = new Map(await exportSecretsMapLive(args.env.env));
  const targets = selectSecrets(args, stored);
  if (targets.length === 0) {
    ok('secrets:seed', `no missing manual secrets in ${args.env.env}`);
    return 0;
  }
  if (process.stdin.isTTY !== true && targets.length !== 1) {
    console.error('secrets:seed: piped stdin seeds exactly one named secret');
    return 2;
  }
  let failed = 0;
  for (const secret of targets) {
    if (!(await seedOne(secret, args, stored))) failed++;
  }
  if (failed === 0) {
    console.log('Run `bun run secrets:pull` to refresh the offline cache.');
  }
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
