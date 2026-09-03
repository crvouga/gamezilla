import type { Session } from '../host/types';
import { defineSurface, type SurfaceDefiners } from './define-surface';
import type { Draw } from './effect';
import { SYSTEM_TAG } from './effect';
import type { Gen } from './gen';

export type SystemGenerate<S, K = void> = (
  session: Session,
  knobs: K
) =>
  | Generator<Draw<unknown>, S, unknown>
  | AsyncGenerator<Draw<unknown>, S, unknown>
  | S
  | Promise<S>;

export type System<S, K = void> = SurfaceDefiners<S> & {
  readonly [SYSTEM_TAG]: true;
  readonly name: string;
  readonly generate: SystemGenerate<S, K>;
};

type ParamsOf<G> = G extends (...args: infer P) => unknown ? P : [];
type KnobsOf<G> = ParamsOf<G> extends [Session, infer K] ? K : void;

type SurfaceOfGenerate<G> = G extends (
  session: Session,
  knobs: never
) => infer R
  ? Awaited<R> extends AsyncGenerator<unknown, infer S, unknown>
    ? S
    : Awaited<R> extends Generator<unknown, infer S, unknown>
      ? S
      : Awaited<R>
  : unknown;

/**
 * `knobs: never` keeps typed knob params assignable under contravariance
 * (same pattern as {@link defineAction}).
 */
export function defineSystem<
  G extends (session: Session, knobs: never) => unknown,
>(def: {
  readonly name: string;
  readonly generate: G;
}): System<SurfaceOfGenerate<G>, KnobsOf<G>> {
  if (!def.name) throw new Error('defineSystem: name is required');
  type S = SurfaceOfGenerate<G>;
  type K = KnobsOf<G>;
  const surface = defineSurface<S>();
  const system = {
    [SYSTEM_TAG]: true as const,
    name: def.name,
    generate: def.generate as unknown as SystemGenerate<S, K>,
    ...surface,
  };
  return system as System<S, K>;
}

export type { Gen };
