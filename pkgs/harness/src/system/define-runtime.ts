import type { Ports, Runtime } from '../runtime/types';
import type { Awaitable } from './awaitable';

export const RUNTIME_TAG = Symbol.for('dst.RuntimeDef');

export type RuntimeDef = {
  readonly [RUNTIME_TAG]: true;
  readonly name: string;
  readonly default: boolean;
  readonly create: () => Awaitable<Runtime<Ports>>;
};

export function defineRuntime(def: {
  readonly name: string;
  readonly default?: boolean;
  readonly create: () => Awaitable<Runtime<Ports>>;
}): RuntimeDef {
  if (!def.name) throw new Error('defineRuntime: name is required');
  return {
    [RUNTIME_TAG]: true,
    name: def.name,
    default: def.default === true,
    create: def.create,
  };
}

export function isRuntimeDef(v: unknown): v is RuntimeDef {
  return (
    typeof v === 'object' &&
    v !== null &&
    RUNTIME_TAG in v &&
    (v as { [RUNTIME_TAG]?: boolean })[RUNTIME_TAG] === true
  );
}
