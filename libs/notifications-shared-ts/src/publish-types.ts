import type { NotificationCategory } from './notification';
import type { NotificationAction } from './notification-action';
import type { NotificationSource } from './notification-id';

export type NotificationPresentation = {
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly iconKey?: string;
  readonly avatar?: {
    readonly fallbackLabel: string;
    readonly avatarConfig?: string | null;
  };
  readonly deepLink?: {
    readonly path: string;
    readonly params?: Readonly<Record<string, string>>;
  };
};

export type PublishNotificationInput = {
  readonly userId: string;
  readonly source: NotificationSource;
  readonly category: NotificationCategory;
  readonly presentation: NotificationPresentation;
  readonly actions: readonly NotificationAction[];
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly priority?: number;
  readonly groupKey?: string;
  readonly expiresAt?: string;
  /**
   * Bring a notification the person already has back as new: unread, and
   * back in the inbox when they archived or dismissed it. Without it a
   * republished notification keeps the read state the person gave it.
   */
  readonly resurface?: boolean;
};

export type UpdateNotificationInput = PublishNotificationInput;

export type DeactivateNotificationInput = {
  readonly userId: string;
  readonly source: NotificationSource;
};

export type NotificationListQuery = {
  readonly userId: string;
  readonly filter?: 'all' | 'action_required' | 'archived';
  readonly cursor?: string;
  readonly limit?: number;
};
