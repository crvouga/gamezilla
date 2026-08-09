import type { HttpClient } from '@pkgs/http-client';
import type { Kv } from '@pkgs/kv/interface';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { HttpLlmProvider } from '../shared/adapters/http-llm-provider';
import { LlmProviderWithKvCache } from '../shared/llm-cache';
import type { LlmProvider } from '../shared/llm-provider';

const LlmReactContext = createContext<LlmProvider | null>(null);

export type LlmContextProviderProps = {
  readonly apiUrl: string;
  readonly kv: Kv;
  readonly http: HttpClient;
  readonly children: ReactNode;
};

/**
 * Provides a {@link LlmProvider} backed by the API + local {@link Kv} cache.
 */
export function LlmContextProvider(
  props: LlmContextProviderProps
): React.ReactElement {
  const value = useMemo<LlmProvider>(
    () =>
      new LlmProviderWithKvCache(
        new HttpLlmProvider({ apiUrl: props.apiUrl, http: props.http }),
        props.kv
      ),
    [props.apiUrl, props.kv, props.http]
  );

  return (
    <LlmReactContext.Provider value={value}>
      {props.children}
    </LlmReactContext.Provider>
  );
}

export function useLlmContext(): LlmProvider {
  const v = useContext(LlmReactContext);
  if (v === null) {
    throw new Error('useLlmContext must be used within LlmContextProvider');
  }
  return v;
}
