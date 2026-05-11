/**
 * Generic session-service contract: queries the active PatchDB session row.
 * Concrete factory lives in `@gamezilla/auth/client/session-service`.
 */
export type AccountSessionRecord = {
  entityId: string;
  deviceId: string;
  accountId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export interface SessionService {
  /** Last {@link refresh} result; call {@link refresh} after writes. */
  getSession(): AccountSessionRecord | null;
  isAuthenticated(): boolean;
  /** Re-reads PatchDB for the active non-expired session for this device. */
  refresh(): Promise<void>;
  clearSession(): Promise<void>;
}
