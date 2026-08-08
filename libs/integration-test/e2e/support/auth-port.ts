/**
 * App-level auth port. Drivers do not know about OAuth providers —
 * each target binding supplies an implementation (Better Auth for web,
 * fakes for in-process, Detox helpers for native).
 */
export interface AuthPort {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  expectSignedOut(): Promise<void>;
}
