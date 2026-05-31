/**
 * Run a command with secrets from Doppler.
 *
 * Defaults come from repo-root `doppler.yaml` (see `readDopplerYamlDefaults`).
 * Override with `DOPPLER_PROJECT` / `DOPPLER_CONFIG` (e.g. `DOPPLER_CONFIG=prd`
 * for infra / prod seeds).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const DOPPLER_YAML = join(REPO_ROOT, 'doppler.yaml');

type DopplerDefaults = {
  readonly project: string;
  readonly config: string;
};

function readDopplerYamlDefaults(): DopplerDefaults {
  let text: string;
  try {
    text = readFileSync(DOPPLER_YAML, 'utf8');
  } catch {
    console.error(`doppler-run: could not read ${DOPPLER_YAML}`);
    process.exit(1);
  }

  const setupBlock = text.match(/setup:\s*([\s\S]*)/)?.[1] ?? text;
  const project = setupBlock.match(/project:\s*(\S+)/)?.[1];
  const config = setupBlock.match(/config:\s*(\S+)/)?.[1];
  if (project === undefined || config === undefined) {
    console.error(
      `doppler-run: could not parse project/config from ${DOPPLER_YAML}`
    );
    process.exit(1);
  }
  return { project, config };
}

function resolveScope(): DopplerDefaults {
  const fromYaml = readDopplerYamlDefaults();
  const project = process.env.DOPPLER_PROJECT?.trim() || fromYaml.project;
  const config = process.env.DOPPLER_CONFIG?.trim() || fromYaml.config;
  return { project, config };
}

const childArgs = process.argv.slice(2);
if (childArgs.length === 0) {
  console.error(
    'usage: bun run scripts/doppler-run.ts -- <command> [args…]\n' +
      'example: bun run scripts/doppler-run.ts -- turbo dev --ui=tui'
  );
  process.exit(1);
}

const { project, config } = resolveScope();
const childEnv = { ...process.env };
delete childEnv.CURSOR_AGENT;
delete childEnv.CURSOR_TRACE_ID;

const result = spawnSync(
  'doppler',
  ['run', '-p', project, '-c', config, '--', ...childArgs],
  {
    cwd: REPO_ROOT,
    env: childEnv,
    stdio: 'inherit',
  }
);

if (result.error !== undefined) {
  console.error(
    `doppler-run: failed to spawn doppler: ${result.error.message}`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
