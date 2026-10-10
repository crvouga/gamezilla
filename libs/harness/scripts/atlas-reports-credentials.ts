// @io-wall-ok — the standalone Atlas server reads the shared reports bucket
/**
 * Reports read credentials for the standalone Atlas server and static export. This machine's current Infisical profile
 * may belong to a different instance than `.infisical.json`, so a bare
 * `infisical export` never sees `REPORTS_*`. Pick the logged-in profile
 * whose domain matches the repo, then read those four values. Nothing here
 * is sent to the browser. The values are the dev environment's read
 * credential for the one bucket OpenTofu provisions.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const REPORTS_KEYS = [
  'REPORTS_BUCKET',
  'REPORTS_ENDPOINT',
  'REPORTS_ACCESS_KEY_ID',
  'REPORTS_SECRET_ACCESS_KEY',
] as const;

export type InfisicalProfile = {
  readonly name: string;
  readonly domain: string;
};

type InfisicalProject = {
  readonly workspaceId: string;
  readonly domain: string;
  readonly defaultEnvironment: string;
};

export function profileNameForDomain(
  profiles: readonly InfisicalProfile[],
  domain: string
): string | null {
  let wanted = '';
  try {
    wanted = new URL(domain).origin;
  } catch {
    return null;
  }
  const matches = profiles.filter(
    (profile) => originOf(profile.domain) === wanted
  );
  const plain = matches.find((profile) => !profile.name.includes('--'));
  return (plain ?? matches[0])?.name ?? null;
}

export function reportsSecretsFromRecord(
  record: Readonly<Record<string, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of REPORTS_KEYS) {
    const value = record[key]?.trim() ?? '';
    if (value.length > 0) out[key] = value;
  }
  return out;
}

/**
 * The four read bindings for the one reports bucket OpenTofu provisions.
 * Local development uses the shared bucket when its credential is complete.
 * Otherwise clear every binding (including inherited values), so the API
 * boots with reports unavailable instead of blocking the localhost stack.
 */
export function reportsDevEnv(
  record: Readonly<Record<string, string>>,
  bucket: string
): Readonly<Record<string, string>> {
  const picked = reportsSecretsFromRecord(record);
  if (
    REPORTS_KEYS.every((key) => picked[key] !== undefined) &&
    picked['REPORTS_BUCKET'] === bucket
  ) {
    return picked;
  }
  return Object.fromEntries(REPORTS_KEYS.map((key) => [key, '']));
}

export function loadReportsDevSecrets(
  repoRoot: string
): Record<string, string> {
  const fromEnv = reportsSecretsFromRecord(
    process.env as Record<string, string>
  );
  if (REPORTS_KEYS.every((key) => fromEnv[key] !== undefined)) return fromEnv;
  const project = readProject(repoRoot);
  if (project === null) return fromEnv;
  const exported = exportInfisical(repoRoot, project);
  return { ...exported, ...fromEnv };
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function readProject(repoRoot: string): InfisicalProject | null {
  const parsed = readJson(join(repoRoot, '.infisical.json'));
  if (parsed === null) return null;
  const workspaceId = stringField(parsed, 'workspaceId');
  const domain = stringField(parsed, 'domain');
  const defaultEnvironment = stringField(parsed, 'defaultEnvironment');
  if (workspaceId === null || domain === null || defaultEnvironment === null) {
    return null;
  }
  return { workspaceId, domain, defaultEnvironment };
}

function exportInfisical(
  repoRoot: string,
  project: InfisicalProject
): Record<string, string> {
  const profile = profileNameForDomain(readProfiles(), project.domain);
  if (profile === null) return {};
  const result = spawnSync(
    'infisical',
    [
      'export',
      '--profile',
      profile,
      '--projectId',
      project.workspaceId,
      '--env',
      project.defaultEnvironment,
      '--domain',
      project.domain,
      '--format=json',
      '--silent',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (result.status !== 0) return {};
  return reportsSecretsFromRecord(secretsRecord(result.stdout));
}

function readProfiles(): readonly InfisicalProfile[] {
  const parsed = readJson(
    join(homedir(), '.infisical', 'infisical-config.json')
  );
  if (parsed === null || !Array.isArray(parsed['profiles'])) return [];
  const profiles: InfisicalProfile[] = [];
  for (const entry of parsed['profiles']) {
    if (entry === null || typeof entry !== 'object') continue;
    const name = stringField(entry, 'name');
    const domain = stringField(entry, 'domain');
    if (name !== null && domain !== null) profiles.push({ name, domain });
  }
  return profiles;
}

function secretsRecord(stdout: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {};
  }
  if (!Array.isArray(parsed)) return {};
  const record: Record<string, string> = {};
  for (const entry of parsed) {
    if (entry === null || typeof entry !== 'object') continue;
    const key = stringField(entry, 'key');
    const value = stringField(entry, 'value');
    if (key !== null && value !== null) record[key] = value;
  }
  return record;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringField(record: object, key: string): string | null {
  if (!(key in record)) return null;
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}
