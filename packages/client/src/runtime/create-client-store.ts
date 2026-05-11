import type { ClientStore } from '@gamezilla/auth/client/client-store-context';
import type { ConfigService } from '@gamezilla/auth/client/config-service-types';
import type { DeviceService } from '@gamezilla/auth/client/device-service';
import { getRuntimeFactories } from '@gamezilla/auth/client/runtime-factories';
import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import type { Logger } from '@gamezilla/lib/logger/logger';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { PatchDbStackValue } from '@gamezilla/patch-db/react';

import {
  awaitSqlClientDisconnectChain,
  enqueueSqlClientLifecycle,
} from './sql-client-lifecycle';

export type PatchStackSink = (stack: PatchDbStackValue | null) => void;

// eslint-disable-next-line max-lines-per-function -- imperative store factory; splitting obscures lifecycle coupling
export function createClientStore(args: {
  logger: Logger;
  secure: SecureStorage;
  config: ConfigService;
  keyValue: KeyValueStorage;
  device: DeviceService;
}): { store: ClientStore; setPatchStack: PatchStackSink } {
  const listeners = new Set<() => void>();
  let accountId: string | null = null;
  let sessionToken: string | null = null;
  let patchStack: PatchDbStackValue | null = null;
  const patchWaiters: ((v: PatchDbStackValue) => void)[] = [];

  const notify = (): void => {
    for (const l of listeners) {
      l();
    }
  };

  const setPatchStack: PatchStackSink = (stack) => {
    patchStack = stack;
    if (stack !== null) {
      for (const w of patchWaiters) {
        w(stack);
      }
      patchWaiters.length = 0;
    }
  };

  const store: ClientStore = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getAccountId(): string | null {
      return accountId;
    },
    setAccountId(id: string | null): void {
      accountId = id;
      notify();
    },

    getSessionToken(): string | null {
      return sessionToken;
    },
    setSessionToken(token: string | null): void {
      sessionToken = token;
      notify();
    },

    getConfigService(): ConfigService {
      return args.config;
    },
    getLogger(): Logger {
      return args.logger;
    },
    getSecureStorage(): SecureStorage {
      return args.secure;
    },
    getKeyValueStorage(): KeyValueStorage {
      return args.keyValue;
    },

    getDeviceService(): Promise<DeviceService> {
      return Promise.resolve(args.device);
    },

    async getSessionService() {
      const stack = await store.getPatchDbStack();
      return getRuntimeFactories().createSessionService(stack.db, args.device);
    },

    async getPatchDbStack(): Promise<PatchDbStackValue> {
      const cur = patchStack;
      if (cur !== null) {
        return cur;
      }
      return await new Promise<PatchDbStackValue>((res) => {
        patchWaiters.push(res);
      });
    },

    enqueueSqlClientLifecycle,
    awaitSqlClientDisconnectChain,
  };

  return { store, setPatchStack };
}
