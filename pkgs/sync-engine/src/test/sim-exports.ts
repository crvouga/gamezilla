/**
 * Curated deterministic-sim surface for product acceptance worlds
 * (`@libs/sim`). Prefer this over deep imports into `src/sim/`.
 */

export type { SimClientHandle } from '../sim/client-handle';
export type { SimClock } from '../sim/clock';
export type { SimDomainPack, SimSessionQuery } from '../sim/domain-pack';
export { emptySimPushChannels } from '../sim/domain-pack';
export type { SeededRng } from '../sim/rng';
export type { NeverOpts, UntilOpts, UntilTarget } from '../sim/until';
export { openSimWorld } from '../sim/world';
export type {
  OpenSimWorldArgs,
  SimWorld,
} from '../sim/world-api';
