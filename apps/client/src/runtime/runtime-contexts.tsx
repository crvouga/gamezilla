import { createContext, useContext } from 'react';
import type { DeviceService } from '../auth/device-service';
import type { SessionService } from '../auth/session-service';

const DeviceServiceContext = createContext<DeviceService | null>(null);

export const DeviceServiceContextProvider = DeviceServiceContext.Provider;

export function useDeviceService(): DeviceService {
  const v = useContext(DeviceServiceContext);
  if (v === null) {
    throw new Error('useDeviceService: DeviceServiceContextProvider missing');
  }
  return v;
}

const SessionServiceContext = createContext<SessionService | null>(null);

export const SessionServiceContextProvider = SessionServiceContext.Provider;

export function useSessionService(): SessionService {
  const v = useContext(SessionServiceContext);
  if (v === null) {
    throw new Error('useSessionService: SessionServiceContextProvider missing');
  }
  return v;
}
