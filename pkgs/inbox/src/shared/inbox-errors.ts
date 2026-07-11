export type InboxErrorCode =
  | 'INBOX_NOT_FOUND'
  | 'INBOX_FORBIDDEN'
  | 'INBOX_UNKNOWN_ACTION'
  | 'INBOX_INVALID_PAYLOAD'
  | 'INBOX_HANDLER_MISSING';

export class InboxError extends Error {
  readonly code: InboxErrorCode;

  constructor(code: InboxErrorCode, message: string) {
    super(message);
    this.name = 'InboxError';
    this.code = code;
  }
}
