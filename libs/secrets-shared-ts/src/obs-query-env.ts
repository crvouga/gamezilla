/** Loaded for `bun obs --source prod`. Never the owner URL or the Grafana admin token. */
export const OBS_QUERY_KEYS = [
  'OBS_TEMPO_URL',
  'OBS_TEMPO_USER',
  'OBS_TEMPO_TOKEN',
  'OBS_LOKI_URL',
  'OBS_LOKI_USER',
  'OBS_PROMETHEUS_URL',
  'OBS_PROMETHEUS_USER',
  'OBS_READONLY_DATABASE_URL',
] as const;

export const PLATFORM_QUERY_KEYS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
] as const;

export function productionQueryRequested(argv: readonly string[]): boolean {
  const source = flagValue(argv, 'source');
  return argv[0] === 'platform' || source === 'prod' || source === 'tempo';
}

/**
 * `--env <name>` (or `--env=<name>`): the environment whose telemetry a
 * production source reads, taken out of the arguments the CLI sees. Absent,
 * the first production environment's.
 */
export function takeEnvFlag(argv: readonly string[]): {
  readonly env: string | undefined;
  readonly argv: readonly string[];
} {
  const rest: string[] = [];
  let env: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg.startsWith('--env=')) env = arg.slice('--env='.length);
    else if (arg === '--env') {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        env = next;
        i++;
      }
    } else rest.push(arg);
  }
  return { env: env === '' ? undefined : env, argv: rest };
}

/** Fills only keys that are unset. An empty stored value is left unset. */
export function fillUnsetEnv(
  env: Record<string, string | undefined>,
  values: ReadonlyMap<string, string>,
  keys: readonly string[]
): void {
  for (const key of keys) {
    const current = env[key];
    if (current !== undefined && current !== '') continue;
    const value = values.get(key);
    if (value === undefined || value === '') continue;
    env[key] = value;
  }
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const flag = `--${name}`;
  const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (inline !== undefined) return inline.slice(flag.length + 1);
  const index = argv.indexOf(flag);
  const next = index === -1 ? undefined : argv[index + 1];
  if (next === undefined || next.startsWith('--')) return undefined;
  return next;
}
