/** Loaded for `bun obs --source prod`. Never the owner URL or the Grafana admin token. */
export const OBS_QUERY_KEYS = [
  'OBS_TEMPO_URL',
  'OBS_TEMPO_USER',
  'OBS_TEMPO_TOKEN',
  'OBS_READONLY_DATABASE_URL',
] as const;

export function productionQueryRequested(argv: readonly string[]): boolean {
  const source = flagValue(argv, 'source');
  return source === 'prod' || source === 'tempo';
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
