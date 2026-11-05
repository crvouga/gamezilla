// @io-wall-ok — prepare external configuration before the child imports product modules.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { configuredIdentity } from '@libs/product-identity-shared-ts/identity-input';
import { configuredCommandInput } from '@libs/secrets-server-ts/configured-command-input';

const root = join(import.meta.dirname, '../../..');
const input = configuredCommandInput(
  process.argv.slice(2),
  process.env['PRODUCT_IDENTITY_MODE']
);
const mode = input.mode;
const requested = input.command;
function repositoryIdentity(): string | undefined {
  const response = spawnSync(
    'gh',
    ['api', 'repos/{owner}/{repo}/actions/variables/PRODUCT_IDENTITY_JSON'],
    {
      cwd: root,
      env: process.env,
      encoding: 'utf8',
    }
  );
  if (response.status !== 0) return undefined;
  try {
    const data = JSON.parse(response.stdout) as { value?: unknown };
    return typeof data.value === 'string' ? data.value : undefined;
  } catch {
    return undefined;
  }
}
const identity =
  mode === 'configured'
    ? configuredIdentity(
        process.env['PRODUCT_IDENTITY_JSON'],
        repositoryIdentity
      )
    : undefined;
const configuredEnv = {
  ...process.env,
  PRODUCT_IDENTITY_MODE: mode,
  PRODUCT_IDENTITY_JSON:
    identity === undefined ? undefined : JSON.stringify(identity),
};
const tasks =
  mode === 'fixture'
    ? [
        '@libs/tools-harness-ts#generate:brand-artifacts',
        '@libs/observability-slo-shared-ts#generate:slo',
        '@libs/tools-harness-ts#generate:identity-agents',
      ]
    : ['@libs/tools-harness-ts#configure:brand'];

if (input.prepareIdentity) {
  const configured = spawnSync(
    process.execPath,
    ['x', 'turbo', 'run', ...tasks],
    { cwd: root, env: configuredEnv, stdio: 'inherit' }
  );
  if (configured.status !== 0) process.exit(configured.status ?? 1);
}

const result = spawnSync(requested[0] ?? '', requested.slice(1), {
  cwd: root,
  env: configuredEnv,
  stdio: 'inherit',
  shell: requested.length === 1,
});
if (result.error !== undefined) throw result.error;
process.exit(result.status ?? 1);
