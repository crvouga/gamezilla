/** @jsxImportSource solid-js */
/**
 * Solid context for the injected {@link PerfSampler}. The provider starts /
 * stops sampling with `active`; `createPerfSnapshot` bridges the sampler's
 * listener API into a tracked signal.
 */

import type { PerfSampler, PerfSnapshot } from '@libs/app-shared/types';
import {
  createNoopPerfSampler,
  EMPTY_PERF_SNAPSHOT,
} from '@libs/app-shared/types';
import { defineContext } from '@pkgs/solid-context-client/define-context';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  untrack,
} from 'solid-js';

const PerfSamplerContext = defineContext<PerfSampler>('PerfSampler');

export type PerfSamplerProviderProps = {
  readonly children: JSX.Element;
  readonly sampler: PerfSampler;
  /** Tracked: while true the sampler runs (HUD visible). */
  readonly active: Accessor<boolean>;
};

export function PerfSamplerProvider(
  props: PerfSamplerProviderProps
): JSX.Element {
  // Composition-root configuration: read once, not tracked.
  const sampler = untrack(() => props.sampler);
  createEffect(() => {
    if (!props.active()) {
      sampler.stop();
      return;
    }
    sampler.start();
    onCleanup(() => sampler.stop());
  });
  return (
    <PerfSamplerContext.Provider value={sampler}>
      {props.children}
    </PerfSamplerContext.Provider>
  );
}

/** Ambient sampler; a no-op sampler when no provider is mounted. */
export function usePerfSampler(): PerfSampler {
  return PerfSamplerContext.useOptional() ?? createNoopPerfSampler();
}

/**
 * Tracked latest {@link PerfSnapshot}. Subscribes only while `enabled` is
 * true so a hidden HUD costs nothing.
 */
export function createPerfSnapshot(
  enabled: Accessor<boolean>
): Accessor<PerfSnapshot> {
  const sampler = usePerfSampler();
  const [snapshot, setSnapshot] =
    createSignal<PerfSnapshot>(EMPTY_PERF_SNAPSHOT);
  createEffect(() => {
    if (!enabled()) return;
    onCleanup(sampler.subscribe((next) => setSnapshot(next)));
  });
  return snapshot;
}
