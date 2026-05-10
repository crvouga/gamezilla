import type { SessionClaims, SessionClaimsPort } from './ports';

export class SessionClaimsNullAdapter implements SessionClaimsPort {
  async verifyBearer(): Promise<SessionClaims | null> {
    return null;
  }
}
