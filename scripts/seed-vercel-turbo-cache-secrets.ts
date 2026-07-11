#!/usr/bin/env bun
/**
 * Seed Infisical with Vercel Remote Cache credentials and remove stale
 * self-hosted `TURBO_API`.
 *
 * Obtain values from the Vercel dashboard:
 * 1. Settings → Tokens → create a scoped access token (Remote Cache access)
 * 2. Team slug from `https://vercel.com/<team-slug>/…`
 *
 * Requires: logged-in Infisical CLI (see `.infisical.json`).
 *
 * Usage:
 *   bun run secrets:seed-vercel-turbo-cache -- --token <token> --team <slug>
 *   TURBO_TOKEN=... TURBO_TEAM=... bun run secrets:seed-vercel-turbo-cache
 *   bun run secrets:seed-vercel-turbo-cache -- --from-local-auth --team <slug>
 *   bun run secrets:seed-vercel-turbo-cache -- --dry-run
 *   bun run secrets:seed-vercel-turbo-cache -- --env prd --force
 */
import {
  deleteSecretIn,
  fetchSecretFrom,
  setSecretIn,
} from '../libs/infra/src/cli/secrets/secrets';
import {
  assertVercelTurboToken,
  readLocalTurboAuthToken,
} from './lib/vercel-turbo-token';

const TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
const STALE_KEY = 'TURBO_API';
const MANAGED_KEYS = ['TURBO_TOKEN', 'TURBO_TEAM'] as const;

type CliOptions = {
  readonly envs: readonly string[];
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly fromLocalAuth: boolean;
  readonly token: string;
  readonly team: string;
};

function parseArgs(argv: readonly string[]): CliOptions {
  let envs: string[] = ['dev', 'prd'];
  let dryRun = false;
  let force = false;
  let fromLocalAuth = false;
  let token = (process.env.TURBO_TOKEN ?? '').trim();
  let team = (process.env.TURBO_TEAM ?? '').trim();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--from-local-auth') {
      fromLocalAuth = true;
      continue;
    }
    if (arg === '--token') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error('--token requires a value');
      }
      token = next.trim();
      i += 1;
      continue;
    }
    if (arg === '--team') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error('--team requires a value');
      }
      team = next.trim();
      i += 1;
      continue;
    }
    if (arg === '--env') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error('--env requires a value (dev or prd)');
      }
      envs = [next];
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (fromLocalAuth) {
    token = readLocalTurboAuthToken();
  }

  if (token.length === 0 || team.length === 0) {
    throw new Error(
      'Missing credentials — pass --token and --team, set TURBO_TOKEN and TURBO_TEAM, or use --from-local-auth with --team.\n' +
        'Create a scoped token at Vercel → Settings → Tokens; team slug is in your team URL.'
    );
  }

  const tokenErr = assertVercelTurboToken(token);
  if (tokenErr !== null) {
    throw new Error(tokenErr);
  }

  if (!TEAM_SLUG_RE.test(team)) {
    throw new Error(
      `Invalid team slug "${team}" — expected lowercase letters, digits, dashes`
    );
  }

  return { envs, dryRun, force, token, team };
}

function readCurrent(env: string, key: string): string | null {
  try {
    const value = fetchSecretFrom(env, key).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function seedEnv(
  env: string,
  options: CliOptions
): { set: number; deleted: number; skipped: number } {
  console.log(`[seed-vercel-turbo-cache] infisical env=${env}`);

  let set = 0;
  let deleted = 0;
  let skipped = 0;

  const values: Record<(typeof MANAGED_KEYS)[number], string> = {
    TURBO_TOKEN: options.token,
    TURBO_TEAM: options.team,
  };

  for (const key of MANAGED_KEYS) {
    const next = values[key];
    const current = readCurrent(env, key);
    if (current === next && !options.force) {
      skipped += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(`[seed-vercel-turbo-cache] [dry-run] would set ${env}/${key}`);
      set += 1;
      continue;
    }

    setSecretIn(env, key, next);
    console.log(`[seed-vercel-turbo-cache] set ${env}/${key}`);
    set += 1;
  }

  const hasStaleApi = readCurrent(env, STALE_KEY) !== null;
  if (hasStaleApi) {
    if (options.dryRun) {
      console.log(
        `[seed-vercel-turbo-cache] [dry-run] would delete ${env}/${STALE_KEY}`
      );
      deleted += 1;
    } else {
      deleteSecretIn(env, STALE_KEY);
      console.log(`[seed-vercel-turbo-cache] deleted ${env}/${STALE_KEY}`);
      deleted += 1;
    }
  }

  console.log(
    `[seed-vercel-turbo-cache] ${env}: ${set} set, ${skipped} unchanged, ${deleted} deleted`
  );
  return { set, deleted, skipped };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  let totalSet = 0;
  let totalDeleted = 0;
  for (const env of options.envs) {
    const result = seedEnv(env, options);
    totalSet += result.set;
    totalDeleted += result.deleted;
  }

  const suffix = options.dryRun ? ' (dry-run)' : '';
  console.log(`[seed-vercel-turbo-cache] done${suffix}`);
  if (totalSet === 0 && totalDeleted === 0 && !options.dryRun) {
    console.log(
      '[seed-vercel-turbo-cache] nothing new to write — Infisical already in sync'
    );
  }
}

main();
