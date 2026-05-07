import type { HostedAuthState, HostedSessionPort } from '../ports';

type SessionSnapshot = {
  readonly isPending: boolean;
  readonly error: unknown;
  readonly data: unknown;
};

type AuthClientLike = {
  getSession: () => Promise<{
    data: unknown;
    error: unknown;
  }>;
};

export class HostedSessionBetterAuthAdapter implements HostedSessionPort {
  constructor(
    private readonly client: AuthClientLike,
    private readonly getSnapshot: () => SessionSnapshot
  ) {}

  getState(): HostedAuthState {
    const s = this.getSnapshot();
    const signedIn =
      s.data !== null &&
      s.data !== undefined &&
      (s.error === null || s.error === undefined);
    return {
      isLoaded: !s.isPending,
      isSignedIn: signedIn,
    };
  }

  async getToken(): Promise<string | null> {
    const res = await this.client.getSession();
    if (res.error !== null && res.error !== undefined) return null;
    if (res.data === null || res.data === undefined) return null;
    const record = res.data as { session?: { token?: string } };
    const tok = record.session?.token;
    return typeof tok === 'string' && tok.length > 0 ? tok : null;
  }
}
