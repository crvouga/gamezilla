/**
 * Read-only gate: validate every registry secret in both `dev` and `prd`.
 */
import { banner, fail as fmtFail, ok } from '../shared/fmt';
import { SECRETS } from '../shared/secrets/registry';
import { SECRETS_ENVS, type SecretsEnv } from '../shared/secrets/secret';
import {
  exportSecretsMap,
  validateSecretOrError,
} from '../shared/secrets/secrets';

const CONCURRENCY = 4;

async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index;
      index += 1;
      const item = items[i];
      if (item === undefined) return;
      await fn(item);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

async function checkEnv(env: SecretsEnv): Promise<number> {
  banner(`Secrets check (${env})`);
  const issues: string[] = [];
  let secrets: ReadonlyMap<string, string>;
  try {
    secrets = await exportSecretsMap(env);
  } catch (e) {
    fmtFail(
      env,
      `failed to export secrets: ${e instanceof Error ? e.message : String(e)}`
    );
    return 1;
  }

  await mapPool(SECRETS, CONCURRENCY, async (entry) => {
    const value = secrets.get(entry.name);
    if (value === undefined || value.trim().length === 0) {
      if (entry.optional) {
        ok(entry.name, 'optional / absent');
        return;
      }
      const msg = `missing in ${env}`;
      fmtFail(entry.name, msg);
      issues.push(`${entry.name}: ${msg}`);
      return;
    }
    const err = await validateSecretOrError(entry, {
      env,
      secretValue: value,
      secrets,
    });
    if (err !== null) {
      fmtFail(entry.name, err);
      issues.push(`${entry.name}: ${err}`);
    } else {
      ok(entry.name);
    }
  });

  return issues.length;
}

async function main(): Promise<void> {
  let total = 0;
  for (const env of SECRETS_ENVS) {
    total += await checkEnv(env);
  }
  if (total > 0) {
    process.stderr.write(
      `\ncheck:secrets failed with ${String(total)} issue(s).\n` +
        'Add missing secrets to @libs/secrets registry or fix invalid values.\n'
    );
    process.exit(1);
  }
  process.stdout.write('\nAll secrets valid in dev + prd.\n');
}

await main();
