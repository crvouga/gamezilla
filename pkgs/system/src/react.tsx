/**
 * React composition root for system Io + optional resource bag.
 * Feature code reads Io via useIo / useClock / useHttpClient / useCreateId.
 */

import { ClockProvider } from '@pkgs/clock';
import { HttpClientProvider } from '@pkgs/http-client';
import { type Io, IoProvider } from '@pkgs/io';
import { IdProvider } from '@pkgs/uuid';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

const ResourcesCtx = createContext<object | null>(null);

export type SystemProviderProps<R extends object = object> = {
  readonly children: ReactNode;
  /** Required — wallIo / createSimIo / ResourceCtx-derived Io. */
  readonly io: Io;
  /**
   * Optional resolved client resource bag (graph deps + app seams).
   * Omit in production; providers keep platform defaults when fields are missing.
   */
  readonly resources?: R;
};

/**
 * Injects {@link Io} projections and an optional typed resource bag for the tree.
 */
export function SystemProvider<R extends object = object>({
  children,
  io,
  resources,
}: SystemProviderProps<R>): ReactNode {
  const resourcesValue = useMemo(() => resources ?? {}, [resources]);
  return (
    <IoProvider io={io}>
      <ClockProvider clock={io.clock} timers={io.timers}>
        <HttpClientProvider client={io.http}>
          <IdProvider createId={io.createId} random={io.random}>
            <ResourcesCtx.Provider value={resourcesValue}>
              {children}
            </ResourcesCtx.Provider>
          </IdProvider>
        </HttpClientProvider>
      </ClockProvider>
    </IoProvider>
  );
}

/** Current resource bag — empty object when omitted at the root. */
export function useSystemResources<R extends object = object>(): R {
  const v = useContext(ResourcesCtx);
  if (v === null) {
    throw new Error(
      'useSystemResources: SystemProvider missing — wrap the tree with SystemProvider'
    );
  }
  return v as R;
}
