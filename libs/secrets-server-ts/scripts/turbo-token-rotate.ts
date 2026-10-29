#!/usr/bin/env bun
/**
 * Point every Turbo run, local and CI, at the Vercel Remote Cache in one
 * command:
 *
 *   1. create a Vercel access token scoped to the Remote Cache team
 *      (`vercel tokens create`, as the account the Vercel CLI is logged into);
 *   2. validate it against the Remote Cache and write it to Infisical as the
 *      shared `TURBO_TOKEN`, deleting any per-environment copy that would
 *      shadow it, and every `TURBO_API` left from an earlier remote cache;
 *   3. revoke the tokens earlier runs of this script created;
 *   4. refresh the offline secrets cache (`secrets:pull`) and, from a
 *      terminal, run `turbo login` so plain `turbo` commands authenticate.
 *
 * Rerunning it rotates the token. A token is revoked again when it cannot be
 * written, so a failed run leaves nothing behind.
 *
 * A Vercel CLI signed in with "Sign in with Vercel" cannot create tokens.
 * Then create one at https://vercel.com/account/tokens (scope: the team
 * above) and pipe it in: steps 2 and 4 run as above, and the tokens it
 * replaces are yours to revoke in the dashboard.
 *
 *   bun run secrets:turbo-token [-- --no-login]
 *   pbpaste | bun run secrets:turbo-token -- --stdin [--no-login]
 */
// @io-wall-ok — composition root (Vercel CLI + Infisical admin CLI)
import { join } from 'node:path';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { ok, warn } from '@libs/secrets-server-ts/fmt';
import {
  deleteSecretIn,
  exportOwnSecretsLive,
  setSecretIn,
} from '@libs/secrets-server-ts/secrets-io';
import { validateSecretOrError } from '@libs/secrets-shared-ts/secret';
import { SHARED_SECRETS_ENV } from '@libs/secrets-shared-ts/shared-secrets';
import { TURBO_TEAM, TURBO_TOKEN } from '@libs/secrets-shared-ts/turbo-token';
import { capture, run, which } from '@pkgs/os-server-ts/command';

const REPO_ROOT = join(import.meta.dirname, '../../..');
/** Names every token this script creates; earlier ones are revoked by it. */
const TOKEN_NAME = `${NAMESPACE} turbo remote cache (${TURBO_TEAM})`;
/** Left by the self-hosted cache this replaced; nothing reads it now. */
const RETIRED_SECRETS = ['TURBO_API'] as const;

type VercelToken = { readonly id: string; readonly name: string };

function vercel(args: readonly string[]): string {
  const result = capture('vercel', [...args, '--non-interactive']);
  if (result.status !== 0)
    throw new Error(
      `vercel ${args.join(' ')} exited ${String(result.status)}: ${result.stderr.trim()}`
    );
  return result.stdout;
}

function listTokens(): readonly VercelToken[] {
  return (
    JSON.parse(vercel(['tokens', 'list', '--json'])) as {
      tokens: VercelToken[];
    }
  ).tokens;
}

function createToken(): { readonly id: string; readonly value: string } {
  const created = JSON.parse(
    vercel(['tokens', 'create', TOKEN_NAME, '--json', '--scope', TURBO_TEAM])
  ) as { bearerToken?: string; token?: { id?: string } };
  const value = created.bearerToken?.trim() ?? '';
  const id = created.token?.id ?? '';
  if (value === '' || id === '')
    throw new Error('vercel tokens create returned no token');
  return { id, value };
}

function revokeToken(id: string): void {
  vercel(['tokens', 'remove', id]);
}

async function writeToken(value: string): Promise<void> {
  const shared = new Map(await exportOwnSecretsLive(SHARED_SECRETS_ENV));
  const error = await validateSecretOrError(TURBO_TOKEN, {
    env: ENV_FILES['dev']!,
    secretValue: value,
    secrets: shared,
  });
  if (error !== null) throw new Error(`TURBO_TOKEN: ${error}`);
  await setSecretIn(SHARED_SECRETS_ENV, TURBO_TOKEN.name, value);
  ok(TURBO_TOKEN.name, `written to secrets env ${SHARED_SECRETS_ENV}`);
}

async function pruneSecrets(): Promise<void> {
  for (const env of [SHARED_SECRETS_ENV, ...Object.keys(ENV_FILES)]) {
    const own = await exportOwnSecretsLive(env);
    // A copy in an environment shadows the shared value it imports.
    const names = [
      ...RETIRED_SECRETS,
      ...(env === SHARED_SECRETS_ENV ? [] : [TURBO_TOKEN.name]),
    ];
    for (const name of names.filter((name) => own.has(name))) {
      await deleteSecretIn(env, name);
      ok(name, `deleted from secrets env ${env}`);
    }
  }
}

async function main(): Promise<number> {
  const login = !process.argv.includes('--no-login');
  if (process.argv.includes('--stdin')) {
    await writeToken((await Bun.stdin.text()).trim());
    await pruneSecrets();
    return finish(login);
  }
  if (!which('vercel')) {
    console.error('turbo-token-rotate: the Vercel CLI is not on PATH');
    return 1;
  }
  const account = capture('vercel', ['whoami']);
  if (account.status !== 0) {
    console.error('turbo-token-rotate: run `vercel login` first');
    return 1;
  }
  ok('vercel', `logged in as ${account.stdout.trim()}`);

  const earlier = listTokens().filter((token) => token.name === TOKEN_NAME);
  const token = createToken();
  ok('vercel', `created token "${TOKEN_NAME}"`);
  try {
    await writeToken(token.value);
  } catch (error) {
    revokeToken(token.id);
    warn('vercel', 'revoked the token it could not write');
    throw error;
  }
  await pruneSecrets();
  for (const { id } of earlier) {
    revokeToken(id);
    ok('vercel', `revoked earlier token ${id}`);
  }

  return finish(login);
}

function finish(login: boolean): number {
  run('bun', ['run', 'secrets:pull'], { cwd: REPO_ROOT });
  if (!login) return 0;
  if (process.stdin.isTTY !== true) {
    warn('turbo login', 'no terminal; run `turbo login` yourself');
    return 0;
  }
  run('turbo', ['login'], { cwd: REPO_ROOT });
  return 0;
}

process.exit(await main());
