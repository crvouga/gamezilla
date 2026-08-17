import type { NotificationCategory } from './notification';

export type StoredNotificationRow = {
  readonly id: string;
  readonly user_id: string;
  readonly source_namespace: string;
  readonly source_type: string;
  readonly source_id: string;
  readonly category: NotificationCategory;
  readonly priority: number;
  readonly group_key: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly body: string | null;
  readonly icon_key: string | null;
  readonly avatar_fallback_label: string | null;
  readonly avatar_config: string | null;
  readonly deep_link_path: string | null;
  readonly deep_link_params: unknown;
  readonly actions: unknown;
  readonly payload: unknown;
  readonly expires_at: string | null;
  readonly read_at: string | null;
  readonly archived_at: string | null;
  readonly dismissed_at: string | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};
