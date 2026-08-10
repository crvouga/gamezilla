import { cliIo } from '../lib/cli-io';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

const EXPO_GRAPHQL_URL = 'https://api.expo.dev/graphql';
const WHOAMI_QUERY = 'query { viewer { username } }';

async function validateExpoToken(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'EXPO_TOKEN');
  try {
    const res = await cliIo.http.fetch(EXPO_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${v}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: WHOAMI_QUERY }),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Expo rejected EXPO_TOKEN — HTTP ${String(res.status)} from ${EXPO_GRAPHQL_URL}`
      );
    }
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: { viewer?: { username?: string } };
      errors?: ReadonlyArray<{ message?: string }>;
    };
    if (json.errors?.length) {
      const msg = json.errors[0]?.message ?? 'GraphQL error';
      throw new Error(`Expo rejected EXPO_TOKEN — ${msg}`);
    }
    if (!json.data?.viewer?.username) {
      throw new Error('EXPO_TOKEN did not resolve to an Expo user');
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Expo')) throw e;
    if (e instanceof Error && e.message.startsWith('EXPO_TOKEN')) throw e;
    // Network blip — don't fail secret validation on transient errors.
  }
}

/**
 * Expo access token for EAS Build / Update in CI (`EXPO_TOKEN`).
 * Lives in `prd` and is mirrored to `dev` for CI checks.
 */
export const EXPO_TOKEN = new Secret({
  name: 'EXPO_TOKEN',
  hint: 'Expo access token from https://expo.dev/settings/access-tokens (CI / EAS CLI)',
  mirrorToDev: true,
  validate: validateExpoToken,
});
