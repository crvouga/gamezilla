import { assert } from '@gamezilla/lib/assert';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';

WebBrowser.maybeCompleteAuthSession();

/**
 * Returns a function that runs Google OAuth and resolves the OpenID `id_token`.
 * `clientId` is the Google Web client ID from the `clientConfig` patch-db entity, matching server audience checks.
 */
export function useGoogleIdTokenPrompt(
  clientId: string
): () => Promise<string> {
  assert.ok(clientId.length > 0, 'Google Web client ID must be non-empty');

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId,
  });

  return useCallback(async (): Promise<string> => {
    assert.ok(
      request !== null,
      'Google AuthRequest not ready — wait for useIdTokenAuthRequest to finish'
    );
    const result = await promptAsync();
    if (result.type === 'cancel') {
      throw new Error('User cancelled Google sign-in');
    }
    if (result.type !== 'success') {
      assert.fail('Google sign-in did not succeed', { type: result.type });
    }
    const idToken = result.params['id_token'];
    assert.string(idToken, 'Google response id_token must be string');
    assert.ok(idToken.length > 0, 'Google response id_token must be non-empty');
    return idToken;
  }, [promptAsync, request]);
}
