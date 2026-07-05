import { useConfigService } from '@libs/auth/client/config-service-context';
import { LlmContextProvider } from '@pkgs/llm/client/llm-context';
import { useKv } from '@pkgs/kv/kv-context';
import type { ReactNode } from 'react';

export function AppLlm({ children }: { children: ReactNode }): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const kv = useKv();
  return (
    <LlmContextProvider apiUrl={apiUrl} kv={kv}>
      {children}
    </LlmContextProvider>
  );
}
