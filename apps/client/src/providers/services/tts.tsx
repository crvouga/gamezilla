import { useConfigService } from '@libs/auth/client/config-service-context';
import { TtsProvider } from '@pkgs/tts/client/tts-context';
import type { ReactNode } from 'react';

export function AppTts({ children }: { children: ReactNode }): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  return <TtsProvider apiUrl={apiUrl}>{children}</TtsProvider>;
}
