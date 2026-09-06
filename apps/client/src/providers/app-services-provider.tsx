import { ComposeProviders } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { AppLlm } from './services/llm';
import { AppObjectStore } from './services/object-store';
import { AppTts } from './services/tts';

const servicesProviders = [AppObjectStore, AppLlm, AppTts];

/** Media / AI backends: object store, LLM, TTS. */
export function AppServicesProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={servicesProviders}>
      {children}
    </ComposeProviders>
  );
}
