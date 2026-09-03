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
export type {
  ExploreOptions,
  NeverObservedOpts,
  ReplayOptions,
  Report,
  Run,
  ScriptOptions,
  Transition,
  UntilObservedOpts,
  Walk,
  WalkOptions,
} from './run';
export {
  ActionNotEnabled,
  DriveError,
  ExploreFailedError,
  explore,
  neverObserved,
  PropertyViolation,
  replay,
  script,
  untilObserved,
  walk,
} from './run';
export type {
  Act,
  Action,
  ActionBody,
  BoundAction,
  BoundObservation,
  Choice,
  Draw,
  Effect,
  Gen,
  Observation,
  Property,
  Repro,
  ReproMeta,
  SurfaceDefiners,
  System,
  SystemGenerate,
} from './system';
export {
  defineAction,
  defineObservation,
  defineProperty,
  defineSurface,
  defineSystem,
  draw,
  observe,
  parseRepro,
  REPRO_VERSION,
  stringifyRepro,
} from './system';
