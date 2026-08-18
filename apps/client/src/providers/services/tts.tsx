import { useConfigService } from '@libs/auth/public/config-service-context';
import { TtsProvider } from '@pkgs/tts/client/tts-context';
import type { ReactNode } from 'react';

/**
 * TTS always mounts so `useSpeak` / SpeakingAvatar stay safe. When the API
 * lacks ElevenLabs secrets, synthesize returns 503 and `useSpeak` fails soft.
 */
export function AppTts({ children }: { children: ReactNode }): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  return <TtsProvider apiUrl={apiUrl}>{children}</TtsProvider>;
}
