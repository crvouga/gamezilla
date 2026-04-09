import { BunDep } from './bun';
import { DopplerDep } from './doppler';
import type { Dep } from './types';
import { WranglerDep } from './wrangler';

export const ALL_DEPS: readonly Dep[] = [
  new WranglerDep(),
  new BunDep(),
  new DopplerDep(),
];
