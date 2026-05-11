import type {
  BetterAuthSessionApi,
  SessionClaims,
  SessionClaimsPort,
} from './ports';

export type { BetterAuthSessionApi };

export class SessionClaimsBetterAuthAdapter implements SessionClaimsPort {
  readonly #auth: BetterAuthSessionApi;

  constructor(auth: BetterAuthSessionApi) {
    this.#auth = auth;
  }

  async verifyBearer(token: string): Promise<SessionClaims | null> {
    const trimmed = token.trim();
    if (trimmed.length === 0) return null;
    try {
      const session = await this.#auth.api.getSession({
        headers: new Headers({
          authorization: `Bearer ${trimmed}`,
        }),
      });
      if (session === null || session.user === undefined) return null;
      const { id, email } = session.user;
      if (typeof id !== 'string' || id.length === 0) return null;
      return {
        subject: id,
        email: typeof email === 'string' ? email : null,
      };
    } catch {
      return null;
    }
  }
}
