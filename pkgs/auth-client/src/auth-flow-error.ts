import type { AuthErrorCode } from '@pkgs/auth-shared/auth-error-code';

/** The service refused the sign-in / link for a reason the UI can explain. */
export class AuthFlowError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(`auth: ${code}`);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}
