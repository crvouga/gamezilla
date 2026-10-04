import { cliHttp } from './cli-io';
import type { SecretInput } from './secret';
import { requireNonEmpty, Secret } from './secret';

async function validateElevenLabsApiKey(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'ELEVEN_LABS_API_KEY');
  try {
    const res = await cliHttp.fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': v },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `ElevenLabs rejected ELEVEN_LABS_API_KEY — HTTP ${String(res.status)}`
      );
    }
    if (!res.ok) {
      throw new Error(`ElevenLabs API returned HTTP ${String(res.status)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('ElevenLabs')) throw e;
    throw new Error(
      `ElevenLabs unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export const ELEVEN_LABS_API_KEY = new Secret({
  name: 'ELEVEN_LABS_API_KEY',
  hint: 'ElevenLabs API key for TTS synthesis',
  pushToApiWorker: true,
  validate: validateElevenLabsApiKey,
});
