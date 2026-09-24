import { cliHttp } from '../cli-io';
import {
  requireHttpsUrl,
  requireNonEmpty,
  Secret,
  type SecretInput,
} from './secret';

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

function openAiModelsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
}

/** Live probe: the key must list models at `OPENAI_BASE_URL`. */
async function validateOpenAiApiKey(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'OPENAI_API_KEY');
  const baseUrl = input.secrets.get('OPENAI_BASE_URL')?.trim() ?? '';
  if (baseUrl.length === 0) return;
  let res: Response;
  try {
    res = await cliHttp.fetch(openAiModelsUrl(baseUrl), {
      headers: { Authorization: `Bearer ${v}` },
    });
  } catch (e) {
    throw new Error(
      `OpenAI unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `OpenAI rejected OPENAI_API_KEY — HTTP ${String(res.status)}`
    );
  }
  if (!res.ok) {
    throw new Error(`OpenAI /models returned HTTP ${String(res.status)}`);
  }
}

export const OPENAI_API_KEY = new Secret({
  name: 'OPENAI_API_KEY',
  hint: 'OpenAI API key for LLM routes',
  pushToApiWorker: true,
  validate: validateOpenAiApiKey,
});

export const OPENAI_BASE_URL = new Secret({
  name: 'OPENAI_BASE_URL',
  hint: 'OpenAI API base URL, e.g. https://api.openai.com',
  pushToApiWorker: true,
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'OPENAI_BASE_URL');
  },
});
