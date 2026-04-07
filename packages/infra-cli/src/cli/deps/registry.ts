import { BunDep } from './bun';
import { DopplerDep } from './doppler';
import { TerraformDep } from './terraform';
import type { Dep } from './types';
import { WranglerDep } from './wrangler';

export const ALL_DEPS: readonly Dep[] = [
  new WranglerDep(),
  new TerraformDep(),
  new BunDep(),
  new DopplerDep(),
];
