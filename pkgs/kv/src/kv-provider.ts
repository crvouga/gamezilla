/**
 * Public {@link Kv} provider for React apps. Defaults to {@link KvPlatform}
 * (web `localStorage` / native `AsyncStorage`); pass `kv` to inject an
 * alternate implementation for tests or alternate backends.
 *
 * The default is created lazily inside `useMemo` so consumers that always
 * pass `kv` do not pull `KvPlatform` into their render path beyond the import
 * graph.
 */
import {
  createElement,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';

import type { Kv } from './interface';
import { KvContextProvider } from './kv-context';
import { KvPlatform } from './kv-platform';

export type KvProviderProps = {
  children: ReactNode;
  /** Inject for tests / non-default backends. Defaults to {@link KvPlatform}. */
  kv?: Kv;
};

export function KvProvider({ children, kv }: KvProviderProps): ReactElement {
  const value = useMemo<Kv>(() => kv ?? new KvPlatform(), [kv]);
  return createElement(KvContextProvider, { value }, children);
}
