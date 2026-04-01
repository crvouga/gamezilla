import { assert } from '../assert';
import type { InjectionToken } from '../dependency-injection/dependency-injection-container';
import { Stage, type IStage } from '../stage/stage';

import publicConfig from '../../../../public-config.json';

export interface ConfigService {
  getString(key: string): string;
}

export const ConfigServiceToken: InjectionToken<ConfigService> =
  Symbol('ConfigService');

type PublicConfig = Record<IStage, Record<string, string>>;

function createConfigService(): ConfigService {
  const stage: IStage = Stage.TRUE ?? 'local';
  const config = (publicConfig as PublicConfig)[stage];
  assert.ok(
    config !== null && config !== undefined,
    'No config found for stage',
    { stage }
  );

  return {
    getString(key: string): string {
      const value = config[key];
      if (value === undefined || value === null) {
        throw new Error(`Config key "${key}" not found for stage "${stage}"`);
      }
      return String(value);
    },
  };
}

export { createConfigService };
