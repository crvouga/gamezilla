import { useConfigService } from '@libs/auth/client/config-service-context';
import { useKv } from '@pkgs/kv/kv-context';
import { LlmContextProvider } from '@pkgs/llm/client/llm-context';
import type { ReactNode } from 'react';

/**
 * LLM context always mounts. When the API lacks OpenAI secrets, structured
 * calls return 503; screens can also gate on `useApiFeatures().features.llm`.
 */
export function AppLlm({ children }: { children: ReactNode }): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const kv = useKv();
  return (
    <LlmContextProvider apiUrl={apiUrl} kv={kv}>
      {children}
    </LlmContextProvider>
  );
}
