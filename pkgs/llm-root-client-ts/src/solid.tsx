/** @jsxImportSource solid-js */
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';
import { HttpLlmProvider } from '@pkgs/llm-root-shared-ts/http-llm-provider';
import { LlmProviderWithKvCache } from '@pkgs/llm-root-shared-ts/llm-cache';
import type { LlmProvider } from '@pkgs/llm-root-shared-ts/llm-provider';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import { type JSX, type ParentProps, untrack } from 'solid-js';

const LlmContext = defineContext<LlmProvider>('Llm');

export type LlmContextProviderProps = ParentProps<{
  readonly apiUrl: string;
  readonly kv: Kv;
  readonly http: HttpClient;
}>;

/**
 * Provides a {@link LlmProvider} backed by the API + local {@link Kv} cache.
 * Inputs are composition-root services; the provider is built once per mount.
 */
export function LlmContextProvider(
  props: LlmContextProviderProps
): JSX.Element {
  // Composition-root configuration: read once, not tracked.
  const value = untrack(
    () =>
      new LlmProviderWithKvCache(
        new HttpLlmProvider({ apiUrl: props.apiUrl, http: props.http }),
        props.kv
      )
  );
  return (
    <LlmContext.Provider value={value}>{props.children}</LlmContext.Provider>
  );
}

export function useLlmContext(): LlmProvider {
  return LlmContext.use();
}
