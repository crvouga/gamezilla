export type FriendsErrorCode =
  | 'FRIENDS_NOT_SIGNED_IN'
  | 'FRIENDS_SELF'
  | 'FRIENDS_ALREADY_FRIENDS'
  | 'FRIENDS_REQUEST_EXISTS'
  | 'FRIENDS_BLOCKED'
  | 'FRIENDS_NOT_FOUND'
  | 'FRIENDS_COOLDOWN'
  | 'FRIENDS_SEARCH_RATE_LIMIT'
  | 'FRIENDS_SEARCH_QUERY_TOO_SHORT'
  | 'FRIENDS_FORBIDDEN';

const STATUS_BY_CODE: Record<FriendsErrorCode, number> = {
  FRIENDS_NOT_SIGNED_IN: 401,
  FRIENDS_SELF: 400,
  FRIENDS_ALREADY_FRIENDS: 409,
  FRIENDS_REQUEST_EXISTS: 409,
  FRIENDS_BLOCKED: 403,
  FRIENDS_NOT_FOUND: 404,
  FRIENDS_COOLDOWN: 429,
  FRIENDS_SEARCH_RATE_LIMIT: 429,
  FRIENDS_SEARCH_QUERY_TOO_SHORT: 400,
  FRIENDS_FORBIDDEN: 403,
};

export class FriendsError extends Error {
  readonly code: FriendsErrorCode;
  readonly status: number;

  constructor(code: FriendsErrorCode, message: string) {
    super(message);
    this.name = 'FriendsError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isFriendsError(error: unknown): error is FriendsError {
  return error instanceof FriendsError;
}
