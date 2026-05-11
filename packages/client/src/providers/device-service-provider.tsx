import { createDeviceService } from '@gamezilla/auth/client/device-service';
import { DeviceServiceProvider } from '@gamezilla/auth/client/device-service-context';
import { useCachedPromise } from '@gamezilla/lib/async/use-cached-promise';
import { useSecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { use, type ReactNode } from 'react';

export function DeviceServiceProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useSecureStorage();
  // `secure` is a stable singleton produced by SecureStorageProvider; the
  // empty cache key is intentional — we only ever want one device-service
  // promise per mount. (The hook still aborts on unmount.)
  const devicePromise = useCachedPromise('', () => createDeviceService(secure));
  const device = use(devicePromise);

  return (
    <DeviceServiceProvider value={device}>{children}</DeviceServiceProvider>
  );
}
