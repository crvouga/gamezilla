#!/usr/bin/env bun
/**
 * Read `DOPPLER_SERVICE_TOKEN` from Doppler and upsert it into GitHub Actions
 * repo secrets via `gh secret set`.
 *
 * Prerequisites:
 * - `doppler login` (personal/team token — not the service token being seeded)
 * - `DOPPLER_SERVICE_TOKEN` stored in the target Doppler config, or
 *   `DOPPLER_SERVICE_TOKEN` / `DOPPLER_TOKEN` in env, or an active `doppler login`
 * - `gh auth login` with permission to manage repo secrets
 *
 * Config: `DOPPLER_CONFIG` env (default `prd`). Project: `DOPPLER_PROJECT` or `doppler.yaml`.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const DOPPLER_YAML = join(REPO_ROOT, 'doppler.yaml');
const SECRET_NAME = 'DOPPLER_SERVICE_TOKEN';
const DEFAULT_DOPPLER_CONFIG = 'prd';

const KNOWN_TOKEN_PREFIXES = ['dp.st.', 'dp.ct.', 'dp.pt.', 'dp.sa.'] as const;

type RunCaptureResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

function fail(message: string): never {
  console.error(`seed-github-doppler-service-token: ${message}`);
  process.exit(1);
}

function runCapture(
  command: string,
  args: readonly string[],
  options?: { input?: string }
): RunCaptureResult {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: options?.input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.error !== undefined) {
    fail(`failed to spawn \`${command}\`: ${result.error.message}`);
  }

  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    status: result.status,
  };
}

function runOrFail(
  command: string,
  args: readonly string[],
  label: string,
  options?: { input?: string }
): string {
  const { stdout, stderr, status } = runCapture(command, args, options);
  if (status !== 0) {
    const detail = stderr.length > 0 ? stderr : stdout;
    fail(
      `${label} failed (exit ${status ?? 'unknown'})${detail ? `: ${detail}` : ''}`
    );
  }
  return stdout;
}

function readDopplerProjectFromYaml(): string {
  let text: string;
  try {
    text = readFileSync(DOPPLER_YAML, 'utf8');
  } catch {
    fail(`could not read ${DOPPLER_YAML}`);
  }

  const setupBlock = text.match(/setup:\s*([\s\S]*)/)?.[1] ?? text;
  const project = setupBlock.match(/project:\s*(\S+)/)?.[1];
  if (project === undefined) {
    fail(`could not parse project from ${DOPPLER_YAML}`);
  }
  return project;
}

function resolveScope(): { project: string; config: string } {
  const project =
    process.env.DOPPLER_PROJECT?.trim() || readDopplerProjectFromYaml();
  const config = process.env.DOPPLER_CONFIG?.trim() || DEFAULT_DOPPLER_CONFIG;
  return { project, config };
}

function isValidDopplerToken(token: string): boolean {
  return KNOWN_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function preflight(): void {
  runOrFail('doppler', ['--version'], 'doppler CLI check');
  runOrFail('gh', ['auth', 'status'], 'gh auth check');
}

function tryFetchTokenFromDoppler(
  project: string,
  config: string
): string | null {
  const { stdout, status } = runCapture('doppler', [
    'secrets',
    'get',
    SECRET_NAME,
    '--plain',
    '--project',
    project,
    '--config',
    config,
  ]);
  if (status !== 0 || stdout.length === 0) {
    return null;
  }
  return stdout;
}

function tryFetchTokenFromEnv(): string | null {
  for (const key of ['DOPPLER_SERVICE_TOKEN', 'DOPPLER_TOKEN'] as const) {
    const value = process.env[key]?.trim();
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return null;
}

function tryFetchTokenFromCli(): string | null {
  const { stdout, status } = runCapture('doppler', [
    'configure',
    'get',
    'token',
    '--plain',
  ]);
  if (status !== 0 || stdout.length === 0) {
    return null;
  }
  return stdout;
}

function validateToken(token: string, source: string): string {
  if (token.length === 0) {
    fail(`${source} resolved a blank ${SECRET_NAME}`);
  }
  if (!isValidDopplerToken(token)) {
    fail(
      `${source} token has an unexpected prefix (expected one of ${KNOWN_TOKEN_PREFIXES.join(', ')}). ` +
        'Ensure the value is a Doppler service/project token.'
    );
  }
  return token;
}

function persistTokenToDoppler(
  project: string,
  config: string,
  token: string
): void {
  runOrFail(
    'doppler',
    ['secrets', 'set', SECRET_NAME, '--project', project, '--config', config],
    `doppler secrets set ${SECRET_NAME}`,
    { input: token }
  );
}

function resolveToken(project: string, config: string): string {
  const fromDoppler = tryFetchTokenFromDoppler(project, config);
  if (fromDoppler !== null) {
    return validateToken(
      fromDoppler,
      `Doppler project=${project} config=${config}`
    );
  }

  const fromEnv = tryFetchTokenFromEnv();
  if (fromEnv !== null) {
    const token = validateToken(fromEnv, 'environment');
    console.log(
      `${SECRET_NAME} not in Doppler project=${project} config=${config}; using env and persisting to Doppler.`
    );
    persistTokenToDoppler(project, config, token);
    return token;
  }

  const fromCli = tryFetchTokenFromCli();
  if (fromCli !== null) {
    const token = validateToken(fromCli, 'doppler configure');
    console.log(
      `${SECRET_NAME} not in Doppler project=${project} config=${config}; using \`doppler configure get token\` and persisting to Doppler.`
    );
    persistTokenToDoppler(project, config, token);
    return token;
  }

  fail(
    `${SECRET_NAME} not found in Doppler project=${project} config=${config}, ` +
      'and no fallback token is available. Set DOPPLER_SERVICE_TOKEN / DOPPLER_TOKEN in env, ' +
      'run `doppler login`, or store the project service token in Doppler first.'
  );
}

function fetchTokenFromDoppler(project: string, config: string): string {
  return resolveToken(project, config);
}

function resolveGitHubRepo(): string {
  const fromGh = runCapture('gh', [
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '-q',
    '.nameWithOwner',
  ]);
  if (fromGh.status === 0 && fromGh.stdout.length > 0) {
    return fromGh.stdout;
  }

  const remote = runCapture('git', ['remote', 'get-url', 'origin']);
  if (remote.status !== 0 || remote.stdout.length === 0) {
    fail(
      'could not resolve GitHub repo (run inside a git repo with `gh` configured or an origin remote)'
    );
  }

  const match =
    remote.stdout.match(/github\.com[:/]([^/]+\/[^/.]+)/)?.[1] ??
    remote.stdout.match(/^([^/]+\/[^/.]+)(?:\.git)?$/)?.[1];
  if (match === undefined) {
    fail(`could not parse owner/repo from git remote: ${remote.stdout}`);
  }
  return match.replace(/\.git$/, '');
}

function setGitHubSecret(repo: string, token: string): void {
  runOrFail(
    'gh',
    ['secret', 'set', SECRET_NAME, '--repo', repo],
    `gh secret set ${SECRET_NAME}`,
    { input: token }
  );
}

function main(): void {
  preflight();
  const { project, config } = resolveScope();
  const token = fetchTokenFromDoppler(project, config);
  const repo = resolveGitHubRepo();
  setGitHubSecret(repo, token);
  console.log(
    `Set ${SECRET_NAME} on ${repo} (from Doppler project=${project} config=${config})`
  );
}

main();
