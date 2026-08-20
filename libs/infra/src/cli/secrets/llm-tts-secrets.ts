import { cliHttp } from '../lib/cli-io';
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

async function validateOpenAiApiKey(input: SecretInput): Promise<void> {
  const key = input.secretValue.trim();
  requireNonEmpty(key, 'OPENAI_API_KEY');
  const base =
    input.secrets.get('OPENAI_BASE_URL')?.trim() || 'https://api.openai.com';
  try {
    const origin = base.replace(/\/$/, '');
    const res = await cliHttp.fetch(`${origin}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `OpenAI rejected OPENAI_API_KEY — HTTP ${String(res.status)}`
      );
    }
    if (!res.ok) {
      throw new Error(`OpenAI API returned HTTP ${String(res.status)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('OpenAI')) throw e;
    throw new Error(
      `OpenAI unreachable: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export const ELEVEN_LABS_API_KEY = new Secret({
  name: 'ELEVEN_LABS_API_KEY',
  hint: 'ElevenLabs API key for TTS synthesis',
  pushToApiWorker: true,
  validate: validateElevenLabsApiKey,
});

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
