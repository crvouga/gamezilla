import type { Interaction } from '../shared/interaction';
import type { InteractionAction } from '../shared/interaction-action';
import { parseJsonArray, parseJsonObject } from '../shared/payload-schema';
import type { StoredInteractionRow } from './types';

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function readNullableString(
  row: Record<string, unknown>,
  key: string
): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function readBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  return false;
}

function buildDeepLink(row: StoredInteractionRow) {
  if (row.deep_link_path === null || row.deep_link_path.length === 0) {
    return undefined;
  }
  const deepLinkParams = parseJsonObject(row.deep_link_params);
  if (Object.keys(deepLinkParams).length === 0) {
    return { path: row.deep_link_path };
  }
  return {
    path: row.deep_link_path,
    params: Object.fromEntries(
      Object.entries(deepLinkParams).map(([key, value]) => [key, String(value)])
    ),
  };
}

function buildOptionalTextFields(
  row: StoredInteractionRow
): Pick<Interaction, 'subtitle' | 'body' | 'groupKey' | 'iconKey'> {
  return {
    ...(row.subtitle !== null && row.subtitle.length > 0
      ? { subtitle: row.subtitle }
      : {}),
    ...(row.body !== null && row.body.length > 0 ? { body: row.body } : {}),
    ...(row.group_key !== null && row.group_key.length > 0
      ? { groupKey: row.group_key }
      : {}),
    ...(row.icon_key !== null && row.icon_key.length > 0
      ? { iconKey: row.icon_key }
      : {}),
  };
}

export function rowToInteraction(row: StoredInteractionRow): Interaction {
  const actions = parseJsonArray<InteractionAction>(row.actions);
  const payload = parseJsonObject(row.payload);
  const deepLink = buildDeepLink(row);
  const optionalText = buildOptionalTextFields(row);

  return {
    id: row.id,
    sourceNamespace: row.source_namespace,
    sourceType: row.source_type,
    sourceId: row.source_id,
    category: row.category,
    title: row.title,
    ...optionalText,
    createdAt: row.created_at,
    priority: row.priority,
    ...(row.expires_at !== null ? { expiresAt: row.expires_at } : {}),
    ...(row.avatar_fallback_label !== null
      ? {
          avatar: {
            fallbackLabel: row.avatar_fallback_label,
            avatarConfig: row.avatar_config,
          },
        }
      : {}),
    actions,
    ...(deepLink !== undefined ? { deepLink } : {}),
    payload,
    isUnread: row.read_at === null,
    isArchived: row.archived_at !== null,
    isDismissed: row.dismissed_at !== null,
    isActive: row.active,
  };
}

export function clientRowToInteraction(
  row: Record<string, unknown>
): Interaction {
  return rowToInteraction({
    id: readString(row, 'id'),
    user_id: readString(row, 'user_id'),
    source_namespace: readString(row, 'source_namespace'),
    source_type: readString(row, 'source_type'),
    source_id: readString(row, 'source_id'),
    category: readString(row, 'category') as StoredInteractionRow['category'],
    priority: Number(row['priority'] ?? 0),
    group_key: readNullableString(row, 'group_key'),
    title: readString(row, 'title'),
    subtitle: readNullableString(row, 'subtitle'),
    body: readNullableString(row, 'body'),
    icon_key: readNullableString(row, 'icon_key'),
    avatar_fallback_label: readNullableString(row, 'avatar_fallback_label'),
    avatar_config: readNullableString(row, 'avatar_config'),
    deep_link_path: readNullableString(row, 'deep_link_path'),
    deep_link_params: row['deep_link_params'],
    actions: row['actions'],
    payload: row['payload'],
    expires_at: readNullableString(row, 'expires_at'),
    read_at: readNullableString(row, 'read_at'),
    archived_at: readNullableString(row, 'archived_at'),
    dismissed_at: readNullableString(row, 'dismissed_at'),
    active: readBoolean(row, 'active'),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  });
}
