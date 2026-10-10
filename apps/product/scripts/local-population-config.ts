import type { SyntheticPopulationConfig } from '@libs/synthetic-population-shared/config';

export function localPopulationConfig(
  current: SyntheticPopulationConfig,
  workers: number
): SyntheticPopulationConfig {
  return {
    ...current,
    desired: workers,
    capacityPerWorker: 1,
    preferredVersion: 'local',
  };
}
