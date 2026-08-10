import { useIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger/logger';
import { LoggerContextProvider } from '@pkgs/logger/react';
import { type ReactNode, useMemo } from 'react';

export function AppLogger({ children }: { children: ReactNode }): ReactNode {
  const io = useIo();
  const logger = useMemo(
    () => createLogger({ name: 'client', now: io.clock.now }),
    [io.clock.now]
  );
  return (
    <LoggerContextProvider value={logger}>{children}</LoggerContextProvider>
  );
}
