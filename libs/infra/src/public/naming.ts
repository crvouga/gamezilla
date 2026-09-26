/**
 * Physical resource names — the same patterns the OpenTofu `naming` module
 * reads, so a Worker's name here and in state can never diverge.
 */
import patterns from '../../tofu/modules/naming/patterns.json';
import type { EnvFile } from './env-file';
import { GLOBAL } from './global';

export type ResourceNames = Readonly<Record<keyof typeof patterns, string>>;

/** Names of one environment's resources. */
export function envResourceNames(env: EnvFile): ResourceNames {
  return resourceNames(GLOBAL.project, env.suffix);
}

export function resourceNames(project: string, suffix: string): ResourceNames {
  const names: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    names[key] = pattern
      .replaceAll('{project}', project)
      .replaceAll('{suffix}', suffix);
  }
  return names as ResourceNames;
}
