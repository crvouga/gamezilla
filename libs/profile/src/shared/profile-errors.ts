export type ProfileErrorCode =
  | 'PROFILE_NOT_AUTHENTICATED'
  | 'PROFILE_USERNAME_EMPTY'
  | 'PROFILE_USERNAME_TOO_SHORT'
  | 'PROFILE_USERNAME_TOO_LONG'
  | 'PROFILE_USERNAME_INVALID_FORMAT'
  | 'PROFILE_USERNAME_TAKEN'
  | 'PROFILE_USERNAME_COOLDOWN'
  | 'PROFILE_NOT_FOUND';

const STATUS_BY_CODE: Record<ProfileErrorCode, number> = {
  PROFILE_NOT_AUTHENTICATED: 401,
  PROFILE_USERNAME_EMPTY: 400,
  PROFILE_USERNAME_TOO_SHORT: 400,
  PROFILE_USERNAME_TOO_LONG: 400,
  PROFILE_USERNAME_INVALID_FORMAT: 400,
  PROFILE_USERNAME_TAKEN: 409,
  PROFILE_USERNAME_COOLDOWN: 429,
  PROFILE_NOT_FOUND: 404,
};

export class ProfileError extends Error {
  readonly code: ProfileErrorCode;
  readonly status: number;

  constructor(code: ProfileErrorCode, message: string) {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isProfileError(error: unknown): error is ProfileError {
  return error instanceof ProfileError;
}

export function profileErrorFromValidation(
  error: 'empty' | 'too_short' | 'too_long' | 'invalid_format'
): ProfileError {
  switch (error) {
    case 'empty':
      return new ProfileError('PROFILE_USERNAME_EMPTY', 'username is required');
    case 'too_short':
      return new ProfileError(
        'PROFILE_USERNAME_TOO_SHORT',
        'username is too short'
      );
    case 'too_long':
      return new ProfileError(
        'PROFILE_USERNAME_TOO_LONG',
        'username is too long'
      );
    case 'invalid_format':
      return new ProfileError(
        'PROFILE_USERNAME_INVALID_FORMAT',
        'username has invalid format'
      );
  }
}
