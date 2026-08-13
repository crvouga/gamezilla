import { createWorld, type ResourceImpl } from '@pkgs/system';

import { system } from '../shared/system';
import { dstProvide } from './provide';

export function openProductWorld(
  seed: number | string | bigint,
  impls: readonly ResourceImpl<unknown, unknown>[]
) {
  return createWorld(system, {
    seed,
    impls,
    provide: dstProvide,
  });
}
