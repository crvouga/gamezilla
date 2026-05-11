import { useDeviceService } from '@gamezilla/auth/client/device-service-context';
import { createSessionService } from '@gamezilla/auth/client/session-service';
import { SessionServiceProvider } from '@gamezilla/auth/client/session-service-context';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useMemo, type ReactNode } from 'react';

export function ClientSessionServiceProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const device = useDeviceService();
  const db = usePatchDb();
  const sessionSvc = useMemo(
    () => createSessionService(db, device),
    [db, device]
  );

  return (
    <SessionServiceProvider value={sessionSvc}>
      {children}
    </SessionServiceProvider>
  );
}
