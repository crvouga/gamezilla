import {
  type ClientRequestAuth,
  clientAuthHeaders,
} from '@libs/auth/public/client-request-auth';

/** Adds current request identity without dropping caller headers or cancellation. */
export function createAuthenticatedFetch(
  httpFetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>,
  auth: ClientRequestAuth
): typeof httpFetch {
  return (input, init) => {
    const headers = new Headers(
      input instanceof Request ? input.headers : undefined
    );
    for (const [key, value] of new Headers(init?.headers))
      headers.set(key, value);
    for (const [key, value] of Object.entries(clientAuthHeaders(auth)))
      headers.set(key, value);
    return httpFetch(input, { ...init, headers });
  };
}
