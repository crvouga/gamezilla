/** @jsxImportSource @solidjs/web */
import { createContext, useContext } from 'solid-js';

import type { MutationClient } from './create-mutation-client';

export const MutationClientContext = createContext<MutationClient>();

export function useMutationClient(): MutationClient {
  return useContext(MutationClientContext);
}
