/**
 * Public {@link Kv} provider for React apps. Defaults to {@link KvPlatform}
 * (web `localStorage` / native `AsyncStorage`); pass `kv` to inject an
 * alternate implementation for tests or alternate backends.
 *
 * The default is created lazily so consumers that always pass `kv` (sims)
 * never load {@link KvPlatform} / AsyncStorage.
 */
import {
  createElement,
  type ReactElement,
  type ReactNode,
  useMemo,
} from 'react';

import type { Kv } from './interface';
import { KvContextProvider } from './kv-context';

export type KvProviderProps = {
  children: ReactNode;
  /** Inject for tests / non-default backends. Defaults to {@link KvPlatform}. */
  kv?: Kv;
};

export function KvProvider({ children, kv }: KvProviderProps): ReactElement {
  const value = useMemo<Kv>(() => {
    if (kv !== undefined) return kv;
    // Lazy: sims inject `kv` and must not touch AsyncStorage / localStorage.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvPlatform } = require('./kv-platform') as {
      KvPlatform: new () => Kv;
    };
    return new KvPlatform();
  }, [kv]);
  return createElement(KvContextProvider, { value }, children);
}
