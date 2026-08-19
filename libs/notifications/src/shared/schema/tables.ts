import { defineTable } from '@pkgs/db-schema';

export const notifications = defineTable({
  domain: 'notifications',
  name: 'notifications',
  columns: {
    user_id: 'text',
    source_namespace: 'text',
    source_type: 'text',
    source_id: 'text',
    category: 'text',
    priority: 'integer',
    group_key: 'text',
    title: 'text',
    subtitle: 'text',
    body: 'text',
    icon_key: 'text',
    avatar_fallback_label: 'text',
    avatar_config: 'text',
    deep_link_path: 'text',
    deep_link_params: 'json',
    actions: 'json',
    payload: 'json',
    expires_at: 'timestamp',
    read_at: 'timestamp',
    archived_at: 'timestamp',
    dismissed_at: 'timestamp',
    active: 'boolean',
  },
  indexes: [
    'user_id',
    ['user_id', 'active', 'archived_at', 'priority', 'created_at'],
  ],
  uniqueIndexes: [['user_id', 'source_namespace', 'source_type', 'source_id']],
});

export const NOTIFICATIONS_TABLES = [notifications] as const;
