import { useConfigService } from '@libs/auth/public/config-service-context';
import { useHttpClient } from '@pkgs/http-client';
import { useKv } from '@pkgs/kv/kv-context';
import { LlmContextProvider } from '@pkgs/llm/client/llm-context';
import type { ReactNode } from 'react';

/**
 * LLM context always mounts. When the API lacks OpenAI secrets, structured
 * calls return 503; screens can also gate on `useClientConfig().config.llm_enabled`.
 */
export function AppLlm({ children }: { children: ReactNode }): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const kv = useKv();
  const http = useHttpClient();
  return (
    <LlmContextProvider apiUrl={apiUrl} kv={kv} http={http}>
      {children}
    </LlmContextProvider>
  );
}
