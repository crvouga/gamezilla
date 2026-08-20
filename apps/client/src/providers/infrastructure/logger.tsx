import { useClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger/logger';
import { LoggerContextProvider } from '@pkgs/logger/react';
import { type ReactNode, useMemo } from 'react';

export function AppLogger({ children }: { children: ReactNode }): ReactNode {
  const clock = useClock();
  const logger = useMemo(
    () => createLogger({ name: 'client', now: clock.now }),
    [clock]
  );
  return (
    <LoggerContextProvider value={logger}>{children}</LoggerContextProvider>
  );
}
