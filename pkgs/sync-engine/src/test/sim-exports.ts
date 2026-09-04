/**
 * Curated deterministic-sim surface for product acceptance systems
 * (`@libs/sim`). Prefer this over deep imports into `src/sim/`.
 */

export type { SimClientHandle } from '../sim/client-handle';
export type { SimDomainPack, SimSessionQuery } from '../sim/domain-pack';
export { emptySimPushChannels } from '../sim/domain-pack';
export type { SeededRng } from '../sim/rng';
export type { SyncApp, SyncArgs, SyncSurface } from '../sim/scenario';
export type {
  NeverOptions,
  UntilTarget,
  WaitUntilOptions,
} from '../sim/wait-until';
