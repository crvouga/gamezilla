import type { ClientRequestAuth } from '@libs/auth-shared-ts/client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared-ts/client-request-auth';
import type { ConfigService } from '@libs/auth-shared-ts/config-service-types';

export type FriendsApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export class FriendsApiClient {
  constructor(
    private readonly config: ConfigService,
    private readonly fetchFn: FriendsApiFetch
  ) {}

  async fetch(
    auth: ClientRequestAuth,
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    const url = `${this.config.getApiUrl()}/api${path}`;
    return this.fetchFn(url, {
      ...init,
      headers: {
        ...clientAuthHeaders(auth),
        ...init?.headers,
      },
    });
  }

  async json<T>(
    auth: ClientRequestAuth,
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const res = await this.fetch(auth, path, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `friends api failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
      );
    }
    return (await res.json()) as T;
  }
}
