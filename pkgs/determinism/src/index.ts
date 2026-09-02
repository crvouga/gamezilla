// Kernel

// Harness
export { COMMAND_STEP_MS } from './harness/apply-commands';
export type {
  Command,
  CommandDef,
  CommandGeneratorContext,
  UnboundCommandDef,
} from './harness/command';
export { command } from './harness/command';
export type {
  AnyScenarioDef,
  ReferenceModelDef,
  ScenarioDef,
} from './harness/define-scenario';
export { defineScenario } from './harness/define-scenario';
export { type KnobDef, type KnobValues, knob } from './harness/knobs';
export {
  type AdvanceCommandOptions,
  advanceCommand,
  networkCommands,
  type PartitionRoles,
} from './harness/network-commands';
export type {
  CountedNodeDef,
  NodeContext,
  NodeDef,
  NodeEntry,
} from './harness/node';
export { node } from './harness/node';
export {
  type FailureReport,
  parseRepro,
  REPRO_VERSION,
  type Repro,
  type ReproInputs,
  type ReproMeta,
  stringifyRepro,
} from './harness/repro';
export { openWorld } from './harness/world';
/** Harness-only port bundle for playground `createSim` and non-World kit tests. */
export type { WorldPorts } from './harness/world-ports';
export { createWorldPorts } from './harness/world-ports';
export type {
  EventuallyOptions,
  NeverOptions,
  OpenWorldOptions,
  World,
} from './harness/world-types';
export { choose } from './kernel/choice';
export {
  canonicalJsonStringify,
  type JsonPrimitive,
  type JsonValue,
} from './kernel/json';
export type { Scheduler, Task, TaskBody } from './kernel/scheduler';
export {
  createTraceRecorder,
  createTraceResolver,
  type TraceRecord,
  type TraceRecorder,
} from './kernel/trace';
// Models
export {
  type Deliver,
  type EndpointId,
  type FlowKey,
  type Network,
  type NetworkFaults,
  type NodeId,
  RELIABLE_NETWORK,
} from './models/network';
export type { Peers } from './models/node';
