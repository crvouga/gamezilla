import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const INBOX_INTERACTIONS_TABLE = 'inbox_interactions' as const;
export const INBOX_PREFERENCES_TABLE = 'inbox_preferences' as const;

export const InboxInteractionCol = {
  id: 'id',
  userId: 'user_id',
  sourceNamespace: 'source_namespace',
  sourceType: 'source_type',
  sourceId: 'source_id',
  category: 'category',
  priority: 'priority',
  groupKey: 'group_key',
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
  iconKey: 'icon_key',
  avatarFallbackLabel: 'avatar_fallback_label',
  avatarConfig: 'avatar_config',
  deepLinkPath: 'deep_link_path',
  deepLinkParams: 'deep_link_params',
  actions: 'actions',
  payload: 'payload',
  expiresAt: 'expires_at',
  readAt: 'read_at',
  archivedAt: 'archived_at',
  dismissedAt: 'dismissed_at',
  active: 'active',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

export const INBOX_INTERACTIONS_TABLE_DEF = defineTable({
  tableName: INBOX_INTERACTIONS_TABLE,
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'user_id', type: 'text' },
    { name: 'source_namespace', type: 'text' },
    { name: 'source_type', type: 'text' },
    { name: 'source_id', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'priority', type: 'integer' },
    { name: 'group_key', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'subtitle', type: 'text' },
    { name: 'icon_key', type: 'text' },
    { name: 'avatar_fallback_label', type: 'text' },
    { name: 'avatar_config', type: 'text' },
    { name: 'deep_link_path', type: 'text' },
    { name: 'deep_link_params', type: 'text' },
    { name: 'actions', type: 'text' },
    { name: 'payload', type: 'text' },
    { name: 'expires_at', type: 'text' },
    { name: 'read_at', type: 'text' },
    { name: 'archived_at', type: 'text' },
    { name: 'dismissed_at', type: 'text' },
    { name: 'active', type: 'integer' },
    { name: 'created_at', type: 'text' },
    { name: 'updated_at', type: 'text' },
  ],
});

export const INBOX_PREFERENCES_TABLE_DEF = defineTable({
  tableName: INBOX_PREFERENCES_TABLE,
  columns: [
    { name: 'user_id', type: 'text', primaryKey: true },
    { name: 'preferences', type: 'text' },
    { name: 'updated_at', type: 'text' },
  ],
});

export const ALL_INBOX_SYNC_TABLES = [
  INBOX_INTERACTIONS_TABLE_DEF,
  INBOX_PREFERENCES_TABLE_DEF,
] as const;
