import type { Session } from '../host/types';
import { defineAction } from './define-action';
import { defineObservation } from './define-observation';
import { defineProperty } from './define-property';
import { type Body, type Draw, SYSTEM_TAG } from './effect';

export type SystemGenerate<S> = (
  session: Session
) =>
  | Generator<Draw<unknown>, S, unknown>
  | AsyncGenerator<Draw<unknown>, S, unknown>
  | S
  | Promise<S>;

export type System<S> = {
  readonly [SYSTEM_TAG]: true;
  readonly name: string;
  readonly generate: SystemGenerate<S>;
  readonly defineObservation: <
    T extends import('../kernel/json').JsonValue,
  >(def: {
    readonly name: string;
    readonly observe: import('./define-observation').ObserveFn<S, T>;
  }) => import('./effect').Observation<S, T>;
  readonly defineAction: (def: {
    readonly name: string;
    readonly generate: () =>
      | Generator<import('./effect').Effect<S>, void, unknown>
      | AsyncGenerator<import('./effect').Effect<S>, void, unknown>;
  }) => import('./effect').Action<S>;
  readonly defineProperty: (def: {
    readonly name: string;
    readonly watch: () =>
      | Generator<
          import('./effect').Observation<S, import('../kernel/json').JsonValue>,
          void,
          unknown
        >
      | AsyncGenerator<
          import('./effect').Observation<S, import('../kernel/json').JsonValue>,
          void,
          unknown
        >;
  }) => import('./effect').Property<S>;
};

export function defineSystem<S>(def: {
  readonly name: string;
  readonly generate: SystemGenerate<S>;
}): System<S> {
  if (!def.name) throw new Error('defineSystem: name is required');
  const system: System<S> = {
    [SYSTEM_TAG]: true,
    name: def.name,
    generate: def.generate,
    defineObservation: defineObservation as System<S>['defineObservation'],
    defineAction: defineAction as System<S>['defineAction'],
    defineProperty: defineProperty as System<S>['defineProperty'],
  };
  return system;
}

export type { Body };
