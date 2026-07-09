import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const ProfileCol = {
  id: 'id',
  createdAt: 'created_at',
  displayName: 'display_name',
  avatarConfig: 'avatar_config',
} as const;

export const PROFILES_TABLE = defineTable({
  tableName: 'profiles',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'created_at', type: 'text' },
    { name: 'display_name', type: 'text' },
    { name: 'avatar_config', type: 'text' },
  ],
});

export const ALL_PROFILE_SYNC_TABLES = [PROFILES_TABLE] as const;
