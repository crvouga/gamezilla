import type { Kv } from '@pkgs/kv/interface';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import {
  HttpLlmProvider,
  type HttpLlmProviderOptions,
} from '../shared/adapters/http-llm-provider';
import { LlmProviderWithKvCache } from '../shared/llm-cache';
import type { LlmProvider } from '../shared/llm-provider';

const LlmReactContext = createContext<LlmProvider | null>(null);

export type LlmContextProviderProps = {
  readonly apiUrl: string;
  readonly kv: Kv;
  readonly fetch?: HttpLlmProviderOptions['fetch'];
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
        new HttpLlmProvider(
          props.fetch === undefined
            ? { apiUrl: props.apiUrl }
            : { apiUrl: props.apiUrl, fetch: props.fetch }
        ),
        props.kv
      ),
    [props.apiUrl, props.kv, props.fetch]
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
