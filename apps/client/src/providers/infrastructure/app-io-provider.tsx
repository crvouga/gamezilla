// @io-wall-ok
/**
 * Composition-root I/O: single {@link Io} bag + projections for existing hooks.
 * Feature code reads via {@link useIo} / useClock / useHttpClient / useCreateId —
 * never bare `fetch` / `Date.now` / `crypto.randomUUID` / timers.
 */
import { ClockProvider } from '@pkgs/clock';
import { HttpClientProvider } from '@pkgs/http-client';
import { type Io, IoProvider, wallIo } from '@pkgs/io';
import { IdProvider } from '@pkgs/uuid';
import { type ReactNode, useMemo } from 'react';

export function AppIoProvider({
  children,
  io: ioOverride,
}: {
  readonly children: ReactNode;
  /** Defaults to {@link wallIo}. Sims inject createSimIo. */
  readonly io?: Io;
}): ReactNode {
  const io = useMemo(() => ioOverride ?? wallIo(), [ioOverride]);
  return (
    <IoProvider io={io}>
      <ClockProvider clock={io.clock} timers={io.timers}>
        <HttpClientProvider client={io.http}>
          <IdProvider createId={io.createId} random={io.random}>
            {children}
          </IdProvider>
        </HttpClientProvider>
      </ClockProvider>
    </IoProvider>
  );
}
