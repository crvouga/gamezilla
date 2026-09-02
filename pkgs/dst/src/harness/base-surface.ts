import type { NodeId } from '../models/network';

/** Built-in Surface every World satisfies via framework controls. */
export type Base = {
  readonly now: () => number;
  advance: (ms: number) => Promise<void>;
  partition: (a: NodeId, b: NodeId) => Disposable;
  heal: (a: NodeId, b: NodeId) => void;
  healAll: () => void;
};
