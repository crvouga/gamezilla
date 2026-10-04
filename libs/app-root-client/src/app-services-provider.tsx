/** @jsxImportSource solid-js */
/**
 * Media / AI backends: object store, LLM, TTS. Each context always mounts —
 * when the API lacks the vendor secrets the calls fail soft (503), so
 * screens never need to guard on provider presence.
 */

import { createAuthenticatedFetch } from '@libs/app-root-shared/create-authenticated-fetch';
import { useClientRequestAuth } from '@libs/auth-client/use-client-request-auth';
import { useHttpClient } from '@pkgs/http-client-client/solid';
import { useKv } from '@pkgs/kv-root-client/solid';
import { LlmContextProvider } from '@pkgs/llm-root-client/solid';
import { ObjectStoreProvider } from '@pkgs/object-store-root-client/solid';
import { TtsProvider } from '@pkgs/tts-root-client/solid';
import type { JSX } from 'solid-js';
import { useClientEnv } from './client-env-context';

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
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const fetch = createAuthenticatedFetch(http.fetch.bind(http), auth);
  return (
    <ObjectStoreProvider value={env.objectStore}>
      <AppLlm>
        <TtsProvider apiUrl={env.serverUrl} fetch={fetch}>
          {props.children}
        </TtsProvider>
      </AppLlm>
    </ObjectStoreProvider>
  );
}
