import type { JsonValue } from '../kernel/json';
import { defineAction } from './define-action';
import { defineObservation } from './define-observation';
import { defineProperty } from './define-property';
import type { Action, Observation, Property } from './effect';

type ArgsOf<G> = G extends (...args: infer A) => unknown ? A : [];

type ArgsOfObs<G> = G extends (s: never, ...args: infer A) => unknown
  ? A extends unknown[]
    ? A
    : unknown[]
  : [];
type ResultOfObs<G> = G extends (...args: never[]) => infer R
  ? Awaited<R> extends Generator<unknown, infer T, unknown>
    ? T
    : Awaited<R> extends AsyncGenerator<unknown, infer T, unknown>
      ? T
      : Awaited<R>
  : JsonValue;

export type SurfaceDefiners<S> = {
  /** `never[]` keeps typed generate params assignable (contravariance). */
  readonly defineAction: <
    G extends (...args: never[]) => import('./effect').ActionBody<S>,
  >(def: {
    readonly name: string;
    readonly generate: G;
  }) => Action<S, ArgsOf<G>>;
  /** `never[]` args — same contravariance fix as {@link defineAction}. */
  readonly defineObservation: <
    G extends (
      s: S,
      ...args: never[]
    ) =>
      | JsonValue
      | Promise<JsonValue>
      | Generator<import('./effect').Effect<S>, JsonValue, unknown>
      | AsyncGenerator<import('./effect').Effect<S>, JsonValue, unknown>,
  >(def: {
    readonly name: string;
    readonly observe: G;
  }) => Observation<
    S,
    ArgsOfObs<G>,
    ResultOfObs<G> extends JsonValue ? ResultOfObs<G> : JsonValue
  >;
  readonly defineProperty: (def: {
    readonly name: string;
    readonly watch: () =>
      | Generator<import('./effect').Effect<S>, void, unknown>
      | AsyncGenerator<import('./effect').Effect<S>, void, unknown>;
  }) => Property<S>;
};

/** Bind the surface type `S` once so `act` / `observe` infer it. */
export function defineSurface<S>(): SurfaceDefiners<S> {
  return {
    defineAction: defineAction as SurfaceDefiners<S>['defineAction'],
    defineObservation:
      defineObservation as SurfaceDefiners<S>['defineObservation'],
    defineProperty: defineProperty as SurfaceDefiners<S>['defineProperty'],
  };
}
