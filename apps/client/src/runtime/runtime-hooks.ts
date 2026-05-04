import type { ConfigService } from '@gamezilla/domain/config/config-service';
import type { Logger } from '@gamezilla/lib/logger/logger';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import type { DeviceService } from '../auth/device-service';
import type { SessionService } from '../auth/session-service';
import {
  configServiceAtom,
  deviceServiceAtom,
  loggerAtom,
  secureStorageAtom,
  sessionServiceAtom,
} from './atoms';

export function useConfigService(): ConfigService {
  return useAtomValue(configServiceAtom);
}

export function useLogger(namespace: string): Logger {
  const root = useAtomValue(loggerAtom);
  return useMemo(() => root.child({ namespace }), [root, namespace]);
}

export function useSecureStorage(): SecureStorage {
  return useAtomValue(secureStorageAtom);
}

export function useDeviceService(): DeviceService {
  return useAtomValue(deviceServiceAtom);
}

export function useSessionService(): SessionService {
  return useAtomValue(sessionServiceAtom);
}
