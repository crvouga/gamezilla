import {
  ClientStoreContextProvider,
  type ClientStore,
} from '@gamezilla/auth/client/client-store-context';
import { registerClientStore } from '@gamezilla/auth/client/client-store-register';
import type { ConfigService } from '@gamezilla/auth/client/config-service-types';
import type { DeviceService } from '@gamezilla/auth/client/device-service';
import { DeviceServiceProvider } from '@gamezilla/auth/client/device-service-context';
import { registerRemoveLocalDataForAccount } from '@gamezilla/auth/client/remove-local-data-for-account-bridge';
import { getRuntimeFactories } from '@gamezilla/auth/client/runtime-factories';
import { SessionServiceProvider } from '@gamezilla/auth/client/session-service-context';
import { createLogger } from '@gamezilla/lib/logger/logger';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import {
  PatchDbStackContextProvider,
  type PatchDbStackValue,
} from '@gamezilla/patch-db/react';
import {
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { createClientStore } from './create-client-store';
import { createPatchDbStack } from './create-patch-db-stack';
import { removeLocalDataForAccount as removeLocalDataForAccountImpl } from './patch-db-runtime';
import { openSqlClientWithLifecycle } from './sql-client-lifecycle';
import { createConfigService } from './store/config-service';
import { createKeyValueStorage } from './store/create-key-value-storage';

async function buildPatchDbStackPipeline(args: {
  device: DeviceService;
  secure: SecureStorage;
  config: ConfigService;
  store: ClientStore;
  signal: AbortSignal;
}): Promise<PatchDbStackValue> {
  const { device, secure, config, store, signal } = args;
  const sql = await openSqlClientWithLifecycle({
    getAccountId: () => store.getAccountId(),
    getDeviceId: () => device.getDeviceId(),
    signal,
  });
  return await createPatchDbStack({
    sql,
    config,
    deviceService: device,
    storage: secure,
    signal,
    getSessionToken: () => store.getSessionToken(),
    setSessionToken: (t) => store.setSessionToken(t),
    getAccountId: () => store.getAccountId(),
  });
}

function DataPlaneEntityBootstrap({
  stack,
  device,
  store,
  accountId,
}: {
  stack: PatchDbStackValue;
  device: DeviceService;
  store: ClientStore;
  accountId: string | null;
}): null {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const factories = getRuntimeFactories();
        const installId = device.getDeviceId();
        await factories.ensureDeviceEntity(stack.db, installId);
        if (cancelled) return;
        const aid = store.getAccountId();
        const myId = aid !== null && aid.length > 0 ? aid : installId;
        await factories.ensureProfile(stack.db, myId);
      } catch {
        // Stale derivations after sql/stack replacement — same rationale as the
        // former `entityBootstrapEffect` swallow.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stack, device, store, accountId]);

  return null;
}

function DataPlaneStackBranch({
  store,
  setPatchStack,
  device,
  secure,
  config,
  children,
}: {
  store: ClientStore;
  setPatchStack: (s: PatchDbStackValue | null) => void;
  device: DeviceService;
  secure: SecureStorage;
  config: ConfigService;
  children: ReactNode;
}): ReactNode {
  const accountId = useSyncExternalStore(
    store.subscribe,
    () => store.getAccountId(),
    () => store.getAccountId()
  );
  const sessionToken = useSyncExternalStore(
    store.subscribe,
    () => store.getSessionToken(),
    () => store.getSessionToken()
  );

  const prevAcRef = useRef<AbortController | null>(null);
  const stackPromise = useMemo(() => {
    void accountId;
    void sessionToken;
    prevAcRef.current?.abort();
    const ac = new AbortController();
    prevAcRef.current = ac;
    return buildPatchDbStackPipeline({
      device,
      secure,
      config,
      store,
      signal: ac.signal,
    });
  }, [accountId, sessionToken, device, secure, config, store]);

  const stack = use(stackPromise);

  useLayoutEffect(() => {
    setPatchStack(stack);
    return () => setPatchStack(null);
  }, [stack, setPatchStack]);

  const sessionSvc = useMemo(
    () => getRuntimeFactories().createSessionService(stack.db, device),
    [stack, device]
  );

  return (
    <PatchDbStackContextProvider value={stack}>
      <DataPlaneEntityBootstrap
        stack={stack}
        device={device}
        store={store}
        accountId={accountId}
      />
      <SessionServiceProvider value={sessionSvc}>
        {children}
      </SessionServiceProvider>
    </PatchDbStackContextProvider>
  );
}

export function ClientDataPlaneProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useMemo(() => getRuntimeFactories().createSecureStorage(), []);
  const logger = useMemo(() => createLogger({ name: 'client' }), []);
  const config = useMemo(() => createConfigService(), []);
  const keyValue = useMemo(() => createKeyValueStorage(), []);

  const devicePromise = useMemo(
    () => getRuntimeFactories().createDeviceService(secure),
    [secure]
  );
  const device = use(devicePromise);

  const { store, setPatchStack } = useMemo(
    () =>
      createClientStore({
        logger,
        secure,
        config,
        keyValue,
        device,
      }),
    [logger, secure, config, keyValue, device]
  );

  useLayoutEffect(() => {
    registerClientStore(store);
    registerRemoveLocalDataForAccount(removeLocalDataForAccountImpl);
    return () => {
      registerRemoveLocalDataForAccount(null);
      registerClientStore(null);
    };
  }, [store]);

  useEffect(() => {
    const f = getRuntimeFactories();
    let cancelled = false;
    void f.readLastLocalAccountId(secure).then((id) => {
      if (!cancelled && id !== null) {
        store.setAccountId(id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [secure, store]);

  return (
    <ClientStoreContextProvider value={store}>
      <DeviceServiceProvider value={device}>
        <DataPlaneStackBranch
          store={store}
          setPatchStack={setPatchStack}
          device={device}
          secure={secure}
          config={config}
        >
          {children}
        </DataPlaneStackBranch>
      </DeviceServiceProvider>
    </ClientStoreContextProvider>
  );
}
