import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import {
  createAlwaysAvailableOrigin,
  type OriginAvailability,
  type OriginAvailabilitySnapshot,
} from './origin-availability';

const Ctx = createContext<OriginAvailability | null>(null);

const alwaysAvailable = createAlwaysAvailableOrigin();

export type OriginAvailabilityProviderProps = {
  readonly children: ReactNode;
  readonly availability: OriginAvailability;
};

export function OriginAvailabilityProvider(
  props: OriginAvailabilityProviderProps
): ReactNode {
  const value = useMemo(() => props.availability, [props.availability]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useOptionalOriginAvailability(): OriginAvailability | null {
  return useContext(Ctx);
}

export function useOriginAvailability(): OriginAvailability {
  const value = useContext(Ctx);
  if (value === null) {
    throw new Error(
      'useOriginAvailability: OriginAvailabilityProvider missing'
    );
  }
  return value;
}

export function useOriginAvailabilitySnapshot(): OriginAvailabilitySnapshot {
  const availability = useContext(Ctx) ?? alwaysAvailable;
  return useSyncExternalStore(
    (listener) => availability.subscribe(listener),
    () => availability.getSnapshot(),
    () => availability.getSnapshot()
  );
}
