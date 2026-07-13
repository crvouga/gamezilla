export type SpacesErrorCode =
  | 'SPACE_NOT_FOUND'
  | 'SPACE_ENDED'
  | 'SPACE_FORBIDDEN'
  | 'SPACE_NOT_SIGNED_IN'
  | 'SPACE_HOST_ALREADY_MEMBER'
  | 'SPACE_INVITE_INVALID'
  | 'SPACE_INVITE_EXPIRED'
  | 'SPACE_INVITE_REVOKED'
  | 'SPACE_INVITE_EXHAUSTED'
  | 'SPACE_VISIBILITY_DENIED'
  | 'SPACE_INVALID_INPUT';

export class SpacesError extends Error {
  readonly code: SpacesErrorCode;

  constructor(code: SpacesErrorCode, message: string) {
    super(message);
    this.name = 'SpacesError';
    this.code = code;
  }
}

export function isSpacesError(error: unknown): error is SpacesError {
  return error instanceof SpacesError;
}
