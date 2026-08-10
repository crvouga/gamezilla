import { defineSchema } from '@pkgs/db-schema';

/**
 * Declarative domain schema for Postgres + local SQLite.
 * Managed columns (`id`, `created_at`, `updated_at`, `deleted_at`) are
 * implicit via `@pkgs/db-schema`. Business identity is the managed text PK `id`.
 *
 * Out of scope: framework tables, kv, entity_store, inbox_schema_state,
 * matchmaking, CHECK/FK/REPLICA IDENTITY, partial indexes.
 */
export const appSchema = defineSchema({
  tables: {
    users: {
      is_anon: 'boolean',
    },
    devices: {
      platform: 'text',
      os_name: 'text',
      os_version: 'text',
      device_model_name: 'text',
      device_brand: 'text',
      device_name: 'text',
      app_version: 'text',
      app_build_number: 'text',
      user_agent: 'text',
      first_seen_at: 'timestamp',
      last_seen_at: 'timestamp',
      account_id: 'text',
      user_id: 'text',
    },
    external_accounts: {
      user_id: 'text',
      provider: 'text',
      external_id: 'text',
      metadata: 'json',
    },
    profiles: {
      username: 'text',
      avatar_config: 'json',
      username_changed_at: 'timestamp',
      username_norm: 'text',
    },
    spaces: {
      title: 'text',
      host_id: 'text',
      ended_at: 'timestamp',
      visibility: 'text',
      host_account_id: 'text',
      host_member_id: 'text',
    },
    space_users: {
      space_id: 'text',
      user_id: 'text',
      created_by_account_id: 'text',
    },
    space_open_sessions: {
      space_id: 'text',
      device_id: 'text',
      opened_at: 'timestamp',
      join_announced: 'boolean',
    },
    friend_requests: {
      from_user_id: 'text',
      to_user_id: 'text',
      status: 'text',
      message: 'text',
      responded_at: 'timestamp',
    },
    friendships: {
      user_low: 'text',
      user_high: 'text',
      source_request_id: 'text',
    },
    user_blocks: {
      blocker_id: 'text',
      blocked_id: 'text',
    },
    chess_puzzles: {
      fen: 'text',
      moves: 'text',
      rating: 'integer',
      rating_deviation: 'integer',
      popularity: 'integer',
      nb_plays: 'integer',
      themes: 'json',
      game_url: 'text',
      opening_tags: 'json',
    },
    chess_puzzle_load: {
      source_etag: 'text',
      cursor: 'text',
      finished_at: 'timestamp',
    },
    chess_puzzle_profiles: {
      owner_id: 'text',
      rating: 'integer',
      rating_deviation: 'integer',
      last_interaction_at: 'timestamp',
    },
    chess_puzzle_interactions: {
      owner_id: 'text',
      puzzle_id: 'text',
      puzzle_rating: 'integer',
      kind: 'text',
      solve_idx: 'integer',
      uci: 'text',
      correct: 'boolean',
      rating_before: 'integer',
      rating_after: 'integer',
      at: 'timestamp',
    },
    client_config: {
      value: 'json',
    },
    inbox_interactions: {
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
    inbox_preferences: {
      user_id: 'text',
      preferences: 'json',
    },
  },
  uniqueIndexes: [
    // Composite / alternate keys (PK `id` is already unique)
    ['external_accounts', 'provider', 'external_id'],
    ['external_accounts', 'user_id', 'provider'],
    ['space_users', 'space_id', 'user_id'],
    ['space_open_sessions', 'device_id', 'space_id'],
    ['friendships', 'user_low', 'user_high'],
    ['user_blocks', 'blocker_id', 'blocked_id'],
    [
      'inbox_interactions',
      'user_id',
      'source_namespace',
      'source_type',
      'source_id',
    ],
    ['inbox_preferences', 'user_id'],
  ],
  indexes: [
    ['devices', 'account_id'],
    ['devices', 'user_id'],
    ['external_accounts', 'user_id'],
    ['profiles', 'username_norm'],
    ['spaces', 'created_at'],
    ['spaces', 'ended_at'],
    ['spaces', 'host_id'],
    ['spaces', 'host_account_id'],
    ['spaces', 'host_member_id'],
    ['space_users', 'space_id'],
    ['space_users', 'user_id'],
    ['space_open_sessions', 'device_id'],
    ['space_open_sessions', 'space_id'],
    ['friend_requests', 'from_user_id'],
    ['friend_requests', 'to_user_id'],
    ['friendships', 'user_low'],
    ['friendships', 'user_high'],
    ['user_blocks', 'blocked_id'],
    ['chess_puzzle_interactions', 'at'],
    ['chess_puzzle_interactions', 'owner_id'],
    ['chess_puzzle_interactions', 'puzzle_id'],
    ['chess_puzzle_profiles', 'owner_id'],
    ['chess_puzzles', 'popularity'],
    ['chess_puzzles', 'rating'],
    ['chess_puzzles', 'rating', 'popularity'],
    ['inbox_interactions', 'user_id'],
  ],
  deprecations: [
    ['chess_puzzles', 'sync_pool', 'not needed anymore'],
    ['client_config', 'enabled', 'unused — use *_enabled / null scalar rows'],
    [
      'client_config',
      'google_web_client_id',
      'unused column — value lives in row id=google_web_client_id',
    ],
  ],
});

/** Domain table names present on the local SQLite client (CACHE). */
export const LOCAL_DOMAIN_TABLE_NAMES = Object.keys(
  appSchema.snapshot().tables
).sort() as readonly string[];
