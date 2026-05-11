import { createLogger } from '@gamezilla/lib/logger/logger';
import { LoggerContextProvider } from '@gamezilla/lib/logger/react';
import { useMemo, type ReactNode } from 'react';

export function LoggerProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const logger = useMemo(() => createLogger({ name: 'client' }), []);
  return (
    <LoggerContextProvider value={logger}>{children}</LoggerContextProvider>
  );
}
