// Public API — algebra of singular primitives

export type { Clock } from '@pkgs/clock';
export type {
  Capability,
  Endpoint,
  Host,
  Ports,
  Session,
  VirtualHostOptions,
  WallHostOptions,
} from './host';
export {
  CapabilityError,
  defineHost,
  virtualHost,
  wallHost,
} from './host';
export type { JsonPrimitive, JsonValue } from './kernel/json';
export type { Rng } from './kernel/rng';
export { asSeededRng } from './kernel/rng';
export type { Scheduler as VirtualScheduler } from './kernel/scheduler';
export type { Scheduler } from './kernel/scheduler-api';
export type {
  Deliver,
  EndpointId,
  FlowKey,
  Network,
  NetworkFaults,
} from './models/network';
export { RELIABLE_NETWORK } from './models/network';
export type {
  ExploreOptions,
  ReplayOptions,
  Report,
  Run,
  ScriptOptions,
  Transition,
  Walk,
  WalkOptions,
} from './run';
export {
  ActionNotEnabled,
  ExploreFailedError,
  explore,
  PropertyViolation,
  replay,
  script,
  walk,
} from './run';
export type {
  Action,
  ActionDef,
  Awaitable,
  CatalogAction,
  CatalogProperty,
  Choice,
  Gen,
  Property,
  PropertyDef,
  Read,
  Repro,
  ReproMeta,
  SurfaceDefiners,
  System,
  SystemGenerate,
} from './system';
export {
  defineAction,
  defineProperty,
  defineSurface,
  defineSystem,
  parseRepro,
  REPRO_VERSION,
  stringifyRepro,
} from './system';
