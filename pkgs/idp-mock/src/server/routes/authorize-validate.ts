/** What every flavor's authorize parser shares: the result shape and the client check. */

import type { IdpAuthRequest, IdpClient } from '../../shared/types';
import type { IdpStore } from '../idp-state';

export type AuthorizeRejection =
  | {
      readonly kind: 'page';
      readonly status: number;
      readonly error: string;
      readonly detail: string;
    }
  | {
      readonly kind: 'redirect';
      readonly error: string;
      readonly detail: string;
    };

export type AuthorizeParse =
  | {
      readonly ok: true;
      readonly client: IdpClient;
      readonly request: IdpAuthRequest;
    }
  | { readonly ok: false; readonly rejection: AuthorizeRejection };

export async function validateClient(
  store: IdpStore,
  params: URLSearchParams
): Promise<
  { readonly client: IdpClient } | { readonly rejection: AuthorizeRejection }
> {
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const client = await store.client(clientId);
  if (client === null) {
    return {
      rejection: {
        kind: 'page',
        status: 401,
        error: 'invalid_client',
        detail: 'The OAuth client was not found.',
      },
    };
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return {
      rejection: {
        kind: 'page',
        status: 400,
        error: 'redirect_uri_mismatch',
        detail: `The redirect URI in the request, ${redirectUri}, does not match the ones authorized for the OAuth client.`,
      },
    };
  }
  return { client };
}
