/** @jsxImportSource solid-js */
import { createContext, useContext } from 'solid-js';

import type { MutationClient } from './create-mutation-client';

export const MutationClientContext = createContext<MutationClient>();

export function useMutationClient(): MutationClient {
  const client = useContext(MutationClientContext);
  if (client === undefined) {
    throw new Error(
      'useMutationClient: provider missing — mount inside MutationClientProvider'
    );
  }
  return client;
}
