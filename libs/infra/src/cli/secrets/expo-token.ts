import type { SecretEntry } from './types';

const EXPO_GRAPHQL_URL = 'https://api.expo.dev/graphql';
const WHOAMI_QUERY = 'query { viewer { username } }';

/**
 * Expo access token for EAS Build / Update in CI (`EXPO_TOKEN`).
 *
 * Create at https://expo.dev/settings/access-tokens. Both EAS paths need it:
 * `infra deploy` publishes an OTA `eas update` (the `publish-client-eas-update`
 * phase) and the manual `infra build-client-native` command runs `eas build`
 * + store submission. Both read Vault config `prd`, so the token must live
 * there; it is mirrored to `dev` via `SHARED_MIRROR_TO_DEV_KEYS` for the
 * `dev`-config CI checks.
 */
export class ExpoToken implements SecretEntry {
  readonly secretKey = 'EXPO_TOKEN';
  readonly env = 'EXPO_TOKEN';
  readonly hint =
    'Expo access token from https://expo.dev/settings/access-tokens (CI / EAS CLI)';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    try {
      const res = await fetch(EXPO_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${v}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: WHOAMI_QUERY }),
      });
      if (res.status === 401 || res.status === 403) {
        return `Expo rejected EXPO_TOKEN — HTTP ${res.status} from ${EXPO_GRAPHQL_URL}`;
      }
      if (!res.ok) {
        return null;
      }
      const json = (await res.json()) as {
        data?: { viewer?: { username?: string } };
        errors?: ReadonlyArray<{ message?: string }>;
      };
      if (json.errors?.length) {
        const msg = json.errors[0]?.message ?? 'GraphQL error';
        return `Expo rejected EXPO_TOKEN — ${msg}`;
      }
      if (!json.data?.viewer?.username) {
        return 'EXPO_TOKEN did not resolve to an Expo user';
      }
      return null;
    } catch {
      return null;
    }
  }
}
