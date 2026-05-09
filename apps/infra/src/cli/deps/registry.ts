import { BunDep } from './bun';
import { DopplerDep } from './doppler';
import { PostgresDep } from './postgres';
import { StripeDep } from './stripe';
import type { Dep } from './types';
import { WranglerDep } from './wrangler';

export const ALL_DEPS: readonly Dep[] = [
  new WranglerDep(),
  new BunDep(),
  new DopplerDep(),
  new StripeDep(),
  new PostgresDep(),
];
