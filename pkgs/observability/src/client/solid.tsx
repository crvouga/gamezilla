/** @jsxImportSource solid-js */
import { useClock } from '@pkgs/clock/solid';
import { defineContext } from '@pkgs/solid-context/define-context';
import { useCreateId } from '@pkgs/uuid/solid';
import { type JSX, type ParentProps, untrack } from 'solid-js';

import type { ObservabilityBackendFactory } from '../port/backend-factory';
import type { Observability } from '../port/observability';
import { createClientObservability } from './create-client-observability';

const ObservabilityContext = defineContext<Observability>('Observability');

export type ObservabilityProviderProps = ParentProps<{
  readonly serviceName?: string;
  readonly backendEnv?: string | undefined;
  readonly forceNoop?: boolean;
  readonly collectorUrl?: string;
  /** Pre-built instance (sims / tests); skips backend resolution. */
  readonly observability?: Observability;
  /** Required when the resolved backend is `local-file`. */
  readonly createLocalFile?: ObservabilityBackendFactory;
}>;

/**
 * Mounts client {@link Observability} for the Solid tree. Built once per mount
 * from the injected clock / id services (composition-root config, not reactive).
 */
export function ObservabilityProvider(
  props: ObservabilityProviderProps
): JSX.Element {
  const clock = useClock();
  const createId = useCreateId();
  // Composition-root configuration: read once, not tracked.
  const observability = untrack(
    () =>
      props.observability ??
      createClientObservability({
        serviceName: props.serviceName ?? 'client',
        now: clock.now,
        createId,
        backendEnv: props.backendEnv,
        ...(props.forceNoop !== undefined
          ? { forceNoop: props.forceNoop }
          : {}),
        ...(props.collectorUrl !== undefined
          ? { collectorUrl: props.collectorUrl }
          : {}),
        ...(props.createLocalFile !== undefined
          ? { createLocalFile: props.createLocalFile }
          : {}),
      })
  );
  return (
    <ObservabilityContext.Provider value={observability}>
      {props.children}
    </ObservabilityContext.Provider>
  );
}

export function useObservability(): Observability {
  return ObservabilityContext.use();
}
