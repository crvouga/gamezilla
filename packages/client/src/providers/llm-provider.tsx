import { useConfigService } from '@gamezilla/auth/client/config-service-context';
import { LlmContextProvider } from '@gamezilla/llm/client/llm-context';
import { useKv } from '@gamezilla/kv/kv-context';
import type { ReactNode } from 'react';

/**
 * Mounts {@link LlmContextProvider} with API origin + device {@link Kv}
 * (same wiring as {@link TtsProviderWrapper}). Must render inside
 * `ConfigServiceProviderWrapper` and `KvProvider`.
 */
export function LlmProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const kv = useKv();
  return (
    <LlmContextProvider apiUrl={apiUrl} kv={kv}>
      {children}
    </LlmContextProvider>
  );
}
