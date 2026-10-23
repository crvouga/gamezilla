import type { NotificationAction } from './notification-action';

export type NotificationCategory =
  | 'action_required'
  | 'informational'
  | 'system';

export type NotificationAvatar = {
  readonly fallbackLabel: string;
  readonly avatarConfig?: string | null;
};

export type NotificationDeepLink = {
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
};

export type Notification = {
  readonly id: string;
  readonly sourceNamespace: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly createdAt: string;
  readonly priority: number;
  readonly groupKey?: string;
  readonly expiresAt?: string;
  readonly iconKey?: string;
  readonly avatar?: NotificationAvatar;
  readonly actions: readonly NotificationAction[];
  readonly deepLink?: NotificationDeepLink;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly isUnread: boolean;
  readonly isArchived: boolean;
  readonly isDismissed: boolean;
  readonly isActive: boolean;
};

export type NotificationFilter = 'all' | 'action_required' | 'archived';

export type NotificationSection = {
  readonly key: string;
  readonly title: string;
  readonly items: readonly Notification[];
};
