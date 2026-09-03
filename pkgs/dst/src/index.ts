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
  Run,
  StartOptions,
  Transition,
  UntilObservedOpts,
  Walk,
  WalkOptions,
} from './run';
export {
  ActionNotEnabled,
  DriveError,
  PropertyViolation,
  start,
  untilObserved,
  walk,
} from './run';
export type {
  Act,
  Action,
  Body,
  Choice,
  Draw,
  Effect,
  Gen,
  Observation,
  Property,
  Repro,
  ReproMeta,
  System,
  SystemGenerate,
} from './system';
export {
  defineAction,
  defineObservation,
  defineProperty,
  defineSystem,
  draw,
  observe,
  parseRepro,
  REPRO_VERSION,
  stringifyRepro,
} from './system';
