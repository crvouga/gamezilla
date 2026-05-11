import { createContext, useContext, type ReactNode } from 'react';

import type { DeviceService } from './device-service';

const DeviceServiceContext = createContext<DeviceService | null>(null);

export function useDeviceService(): DeviceService {
  const v = useContext(DeviceServiceContext);
  if (v === null) {
    throw new Error(
      'useDeviceService: missing provider — wrap the app with AppProviders from @gamezilla/client'
    );
  }
  return v;
}

export function DeviceServiceProvider({
  value,
  children,
}: {
  value: DeviceService;
  children: ReactNode;
}): ReactNode {
  return (
    <DeviceServiceContext.Provider value={value}>
      {children}
    </DeviceServiceContext.Provider>
  );
}
