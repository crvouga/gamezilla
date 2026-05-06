import { verifyToken } from '@clerk/backend';
import type { SessionClaims, SessionClaimsPort } from '../ports';

export class SessionClaimsClerkAdapter implements SessionClaimsPort {
  readonly #secretKey: string;

  constructor(secretKey: string) {
    this.#secretKey = secretKey.trim();
  }

  async verifyBearer(token: string): Promise<SessionClaims | null> {
    if (this.#secretKey.length === 0) return null;
    const trimmed = token.trim();
    if (trimmed.length === 0) return null;
    try {
      const payload = await verifyToken(trimmed, {
        secretKey: this.#secretKey,
      });
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      if (sub.length === 0) return null;
      const rawEmail = (payload as Record<string, unknown>)['email'];
      const email = typeof rawEmail === 'string' ? rawEmail : null;
      return { subject: sub, email };
    } catch {
      return null;
    }
  }
}

export function createClerkSessionClaimsPort(
  secretKey: string
): SessionClaimsPort {
  return new SessionClaimsClerkAdapter(secretKey);
}
