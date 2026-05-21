import { useConfigService } from '@gamezilla/auth/client/config-service-context';
import { TtsProvider } from '@gamezilla/tts/client/tts-context';
import type { ReactNode } from 'react';

/**
 * Mounts {@link TtsProvider} with the runtime API origin resolved from
 * `useConfigService()` (the same source `AuthBridge` uses). Must render inside
 * `ConfigServiceProviderWrapper`.
 */
export function TtsProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  return <TtsProvider apiUrl={apiUrl}>{children}</TtsProvider>;
}
