import type {
  CountedNodeDef as ModelCountedNodeDef,
  NodeContext as ModelNodeContext,
  NodeDef as ModelNodeDef,
} from '../models/node';
import type { WorldPorts } from './world-ports';

/** Node start context with the concrete harness port bundle. */
export type NodeContext = ModelNodeContext<WorldPorts>;

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous node handles
export type NodeDef<H = any> = ModelNodeDef<H, WorldPorts>;
export type CountedNodeDef<H = unknown> = ModelCountedNodeDef<H, WorldPorts>;
export type NodeEntry = NodeDef | CountedNodeDef;

/** Declare a Node kind: `start(ctx)` returns its handle; optional `stop`. */
export function node<H>(def: NodeDef<H>): NodeDef<H> {
  return def;
}
