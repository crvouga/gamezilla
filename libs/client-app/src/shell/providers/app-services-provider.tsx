/** @jsxImportSource solid-js */
/**
 * Media / AI backends: object store, LLM, TTS. Each context always mounts —
 * when the API lacks the vendor secrets the calls fail soft (503), so
 * screens never need to guard on provider presence.
 */

import { useHttpClient } from '@pkgs/http-client/solid';
import { useKv } from '@pkgs/kv/solid';
import { LlmContextProvider } from '@pkgs/llm/solid';
import { ObjectStoreProvider } from '@pkgs/object-store/solid';
import { TtsProvider } from '@pkgs/tts/solid';
import type { JSX } from 'solid-js';

import { useClientEnv } from '../client-env-context';

function AppLlm(props: { readonly children: JSX.Element }): JSX.Element {
  const env = useClientEnv();
  const kv = useKv();
  const http = useHttpClient();
  return (
    <LlmContextProvider apiUrl={env.serverUrl} kv={kv} http={http}>
      {props.children}
    </LlmContextProvider>
  );
}

export function AppServicesProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <ObjectStoreProvider value={env.objectStore}>
      <AppLlm>
        <TtsProvider apiUrl={env.serverUrl}>{props.children}</TtsProvider>
      </AppLlm>
    </ObjectStoreProvider>
  );
}
