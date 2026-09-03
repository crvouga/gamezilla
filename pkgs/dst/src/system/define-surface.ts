import type { Awaitable } from './awaitable';
import { defineAction } from './define-action';
import { defineProperty } from './define-property';
import type { Action, ArgsGen, Property } from './effect';

export type SurfaceDefiners<S> = {
  readonly defineAction: <const A extends unknown[] = []>(def: {
    readonly name: string;
    readonly enabled?: (s: S) => Awaitable<boolean>;
    readonly weight?: number | ((s: S) => Awaitable<number>);
    readonly args?: (s: S) => Awaitable<ArgsGen<A>>;
    readonly act: (s: S, ...args: A) => Awaitable<void>;
  }) => Action<S, A>;
  readonly defineProperty: <C = void>(def: {
    readonly name: string;
    readonly setup?: (s: S) => Awaitable<C>;
    readonly check: (s: S, ctx: C) => Awaitable<C | void>;
    readonly close?: (ctx: C) => Awaitable<void>;
  }) => Property<S, C>;
};

/** Bind the surface type `S` once so `act` / `check` infer it. */
export function defineSurface<S>(): SurfaceDefiners<S> {
  return {
    defineAction: defineAction as SurfaceDefiners<S>['defineAction'],
    defineProperty: defineProperty as SurfaceDefiners<S>['defineProperty'],
  };
}
