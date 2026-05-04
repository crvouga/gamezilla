import { ConfigServiceContextProvider } from '@gamezilla/domain/config/config-service';
import { LoggerContextProvider } from '@gamezilla/lib/logger/react';
import { SecureStorageContextProvider } from '@gamezilla/lib/secure-storage/interface';
import { PatchDbStackContextProvider } from '@gamezilla/patch-db/react';
import { useAtom, useAtomValue } from 'jotai';
import type { ReactNode } from 'react';
import {
  configServiceAtom,
  deviceServiceAtom,
  loggerAtom,
  patchDbStackAtom,
  secureStorageAtom,
  sessionServiceAtom,
} from './atoms';
import { hydrateAccountIdEffect } from './hydrate';
import {
  DeviceServiceContextProvider,
  SessionServiceContextProvider,
} from './runtime-contexts';

export function RuntimeBridge({ children }: { children: ReactNode }) {
  useAtom(hydrateAccountIdEffect);
  const config = useAtomValue(configServiceAtom);
  const logger = useAtomValue(loggerAtom);
  const secureStorage = useAtomValue(secureStorageAtom);
  const deviceService = useAtomValue(deviceServiceAtom);
  const sessionService = useAtomValue(sessionServiceAtom);
  const stack = useAtomValue(patchDbStackAtom);

  return (
    <ConfigServiceContextProvider value={config}>
      <LoggerContextProvider value={logger}>
        <SecureStorageContextProvider value={secureStorage}>
          <DeviceServiceContextProvider value={deviceService}>
            <SessionServiceContextProvider value={sessionService}>
              <PatchDbStackContextProvider value={stack}>
                {children}
              </PatchDbStackContextProvider>
            </SessionServiceContextProvider>
          </DeviceServiceContextProvider>
        </SecureStorageContextProvider>
      </LoggerContextProvider>
    </ConfigServiceContextProvider>
  );
}
