import type { NotificationCategory } from '../shared/notification';
import type { NotificationAction } from '../shared/notification-action';
import type { NotificationSource } from '../shared/notification-id';

export type { StoredNotificationRow } from '../shared/stored-notification-row';

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
