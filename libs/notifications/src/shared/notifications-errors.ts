export type NotificationsErrorCode =
  | 'NOTIFICATIONS_NOT_FOUND'
  | 'NOTIFICATIONS_FORBIDDEN'
  | 'NOTIFICATIONS_UNKNOWN_ACTION'
  | 'NOTIFICATIONS_INVALID_PAYLOAD'
  | 'NOTIFICATIONS_HANDLER_MISSING';

export class NotificationsError extends Error {
  readonly code: NotificationsErrorCode;

  constructor(code: NotificationsErrorCode, message: string) {
    super(message);
    this.name = 'NotificationsError';
    this.code = code;
  }
}
