/**
 * Public {@link Kv} provider for React apps. Callers inject the backend
 * (`KvPlatform` from `@pkgs/kv-web` / `@pkgs/kv-expo`, or a test fake).
 */
import { createElement, type ReactElement, type ReactNode } from 'react';

import type { Kv } from './interface';
import { KvContextProvider } from './kv-context';

export type KvProviderProps = {
  children: ReactNode;
  kv: Kv;
};

export function KvProvider({ children, kv }: KvProviderProps): ReactElement {
  return createElement(KvContextProvider, { value: kv }, children);
}
