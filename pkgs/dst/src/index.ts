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
  Script,
  ScriptOptions,
  Transition,
  Walk,
  WalkOptions,
} from './script';
export {
  ActionNotEnabled,
  ExploreFailedError,
  PropertyViolation,
} from './script';
export type {
  Action,
  ActionDef,
  Awaitable,
  CatalogAction,
  CatalogProperty,
  Choice,
  Gen,
  HostDef,
  Property,
  PropertyDef,
  Read,
  Repro,
  ReproMeta,
  System,
  SystemCreate,
  SystemGenerate,
} from './system';
export {
  defineAction,
  defineSystem,
  parseRepro,
  REPRO_VERSION,
  stringifyRepro,
} from './system';
