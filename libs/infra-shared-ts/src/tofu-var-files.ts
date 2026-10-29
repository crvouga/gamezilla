/**
 * The variable files OpenTofu reads, resolved from the committed ones
 * (`tofu-vars.ts`) and keyed by their path under `varsDir`
 * (`tofu-command.ts`). The wrapper writes exactly these before any `tofu`
 * run, so OpenTofu sees the values the placeholders stand for.
 *
 *   global.tfvars.json       every stack, first
 *   envs/<env>.tfvars.json   a per-environment stack, second
 *   envs.tfvars.json         a global stack, second: `envs`, every env file
 *                            by name (the fleet and bootstrap stacks)
 */
import {
  PRODUCT,
  type ProductIdentity,
} from '@libs/product-identity-shared-ts/product-identity';
import { ENV_SOURCES } from './envs';
import { GLOBAL_SOURCE } from './global';
import { ENVS_VAR_FILE, envVarFile, GLOBAL_VAR_FILE } from './tofu-command';
import { resolveEnvVars, resolveGlobalVars } from './tofu-vars';

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function resolvedVarFiles(
  identity: ProductIdentity = PRODUCT
): ReadonlyMap<string, string> {
  const envs = Object.fromEntries(
    Object.entries(ENV_SOURCES).map(([name, source]) => [
      name,
      resolveEnvVars(source, identity),
    ])
  );
  const files = new Map<string, string>([
    [GLOBAL_VAR_FILE, jsonText(resolveGlobalVars(GLOBAL_SOURCE, identity))],
    [ENVS_VAR_FILE, jsonText({ envs })],
  ]);
  for (const [name, values] of Object.entries(envs))
    files.set(envVarFile(name), jsonText(values));
  return files;
}
