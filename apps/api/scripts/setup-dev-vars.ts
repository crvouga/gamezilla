import { DopplerCli } from '@pkgs/doppler';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(apiRoot, '.dev.vars');
const tmpPath = `${outPath}.${process.pid}.tmp`;

function encodeDevVarValue(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')}"`;
}

/**
 * Doppler config-scoped service tokens (`dp.st.…`) are self-describing — the
 * secrets-download API does not require `project`/`config`. All other token
 * formats (CLI `dp.ct.`, personal `dp.pt.`, service account `dp.sa.`) require
 * both query params and otherwise return HTTP 400.
 */
function tokenRequiresScopeParams(token: string): boolean {
  return !token.startsWith('dp.st.');
}

type DopplerScope = {
  token: string;
  project: string | null;
  config: string | null;
};

function resolveDopplerScope(): DopplerScope {
  const cli = new DopplerCli();
  let token: string;
  try {
    const resolved = cli.resolveToken();
    if (resolved.source === 'cli') {
      process.stdout.write(
        '[setup-dev-vars] DOPPLER_TOKEN not set in env; using `doppler configure get token --plain`.\n'
      );
    }
    token = resolved.token;
  } catch {
    process.stderr.write(
      '[setup-dev-vars] DOPPLER_TOKEN is required. Set it in env, or login/configure Doppler CLI so `doppler configure get token --plain` succeeds.\n'
    );
    process.exit(1);
  }

  const envProject = process.env['DOPPLER_PROJECT']?.trim() ?? '';
  const envConfig = process.env['DOPPLER_CONFIG']?.trim() ?? '';
  const project =
    envProject.length > 0 ? envProject : cli.tryConfigureGetProjectPlain();
  const config =
    envConfig.length > 0 ? envConfig : cli.tryConfigureGetConfigPlain();

  if (
    tokenRequiresScopeParams(token) &&
    (project === null || config === null)
  ) {
    process.stderr.write(
      '[setup-dev-vars] DOPPLER_TOKEN is not a config-scoped service token (`dp.st.…`); ' +
        'DOPPLER_PROJECT and DOPPLER_CONFIG must be resolvable from env or `doppler configure`.\n'
    );
    process.exit(1);
  }

  return { token, project, config };
}

async function main(): Promise<void> {
  const { token, project, config } = resolveDopplerScope();
  const lines: string[] = [`DOPPLER_TOKEN=${encodeDevVarValue(token)}`];
  if (project !== null) {
    lines.push(`DOPPLER_PROJECT=${encodeDevVarValue(project)}`);
  }
  if (config !== null) {
    lines.push(`DOPPLER_CONFIG=${encodeDevVarValue(config)}`);
  }

  const body = `${lines.join('\n')}\n`;
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-dev-vars] wrote .dev.vars with keys: ${lines
      .map((l) => l.split('=')[0])
      .join(', ')} (DB_URL and other config load from Doppler at Worker boot)\n`
  );
}

await main();
