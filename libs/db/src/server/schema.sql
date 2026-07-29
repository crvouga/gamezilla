-- ============ Base schema ============
-- Idempotent Postgres DDL for the PowerSync source database.
-- Re-run in full on every deploy. Statements must stay safe to repeat.

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ,
  platform TEXT,
  os_name TEXT,
  os_version TEXT,
  device_model_name TEXT,
  device_brand TEXT,
  device_name TEXT,
  app_version TEXT,
  app_build_number TEXT,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS devices_id_idx ON devices (id);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  username TEXT NOT NULL DEFAULT '',
  avatar_config JSONB
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  title TEXT,
  host_id TEXT,
  created_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS spaces_host_id_idx ON spaces (host_id);
CREATE INDEX IF NOT EXISTS spaces_created_at_idx ON spaces (created_at DESC);
CREATE INDEX IF NOT EXISTS spaces_ended_at_idx ON spaces (ended_at);

-- Legacy `space_memberships` is no longer created for fresh installs.
-- Existing DBs keep the table until the space_users migration drops it.

CREATE TABLE IF NOT EXISTS chess_puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  rating_deviation INTEGER NOT NULL DEFAULT 0,
  popularity INTEGER NOT NULL DEFAULT 0,
  nb_plays INTEGER NOT NULL DEFAULT 0,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  game_url TEXT,
  opening_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sync_pool BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE chess_puzzles
  ADD COLUMN IF NOT EXISTS sync_pool BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS chess_puzzles_rating_idx ON chess_puzzles (rating);
CREATE INDEX IF NOT EXISTS chess_puzzles_popularity_idx
  ON chess_puzzles (popularity DESC);
CREATE INDEX IF NOT EXISTS chess_puzzles_rating_popularity_idx
  ON chess_puzzles (rating, popularity DESC);
CREATE INDEX IF NOT EXISTS chess_puzzles_sync_pool_popularity_idx
  ON chess_puzzles (rating, popularity DESC)
  WHERE sync_pool = true;

DROP TABLE IF EXISTS chess_puzzle_sync_pool;

CREATE TABLE IF NOT EXISTS chess_puzzle_load (
  id TEXT PRIMARY KEY,
  source_etag TEXT,
  cursor TEXT,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chess_puzzle_profiles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1200,
  rating_deviation INTEGER NOT NULL DEFAULT 350,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chess_puzzle_profiles_owner_id_idx
  ON chess_puzzle_profiles (owner_id);

CREATE TABLE IF NOT EXISTS chess_puzzle_interactions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  puzzle_id TEXT NOT NULL,
  puzzle_rating INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  solve_idx INTEGER NOT NULL DEFAULT 0,
  uci TEXT,
  correct BOOLEAN,
  rating_before INTEGER NOT NULL DEFAULT 0,
  rating_after INTEGER NOT NULL DEFAULT 0,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_owner_id_idx
  ON chess_puzzle_interactions (owner_id);
CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_puzzle_id_idx
  ON chess_puzzle_interactions (puzzle_id);
CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_at_idx
  ON chess_puzzle_interactions (at DESC);

CREATE TABLE IF NOT EXISTS client_config (
  id TEXT PRIMARY KEY,
  google_web_client_id TEXT
);

CREATE TABLE IF NOT EXISTS entity_store (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  owner_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (namespace, type, external_id)
);

CREATE INDEX IF NOT EXISTS entity_store_namespace_type_idx
  ON entity_store (namespace, type);
CREATE INDEX IF NOT EXISTS entity_store_namespace_owner_idx
  ON entity_store (namespace, owner_id);

-- ============ Incremental changes ============

ALTER TABLE devices ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id TEXT;
UPDATE devices SET user_id = account_id
WHERE user_id IS NULL AND account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices (user_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_accounts (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, external_id),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS external_accounts_user_id_idx
  ON external_accounts (user_id);

-- ============ Profiles: username ============

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'profiles'
      AND column_name = 'username_norm'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN username_norm TEXT GENERATED ALWAYS AS (lower(username)) STORED;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_norm_uidx
  ON profiles (username_norm)
  WHERE username <> '';

CREATE INDEX IF NOT EXISTS profiles_username_norm_prefix_idx
  ON profiles (username_norm text_pattern_ops);

DROP INDEX IF EXISTS profiles_display_name_trgm_idx;

ALTER TABLE profiles DROP COLUMN IF EXISTS display_name;

-- ============ Friends ============

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES profiles (id),
  to_user_id TEXT NOT NULL REFERENCES profiles (id),
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT friend_requests_no_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT friend_requests_status_check CHECK (
    status IN ('pending', 'accepted', 'declined', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_uidx
  ON friend_requests (from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_to_pending_idx
  ON friend_requests (to_user_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_from_pending_idx
  ON friend_requests (from_user_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_history_idx
  ON friend_requests (from_user_id, to_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_low TEXT NOT NULL REFERENCES profiles (id),
  user_high TEXT NOT NULL REFERENCES profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_request_id TEXT REFERENCES friend_requests (id),
  CONSTRAINT friendships_canonical CHECK (user_low < user_high),
  UNIQUE (user_low, user_high)
);

CREATE INDEX IF NOT EXISTS friendships_user_low_idx ON friendships (user_low);
CREATE INDEX IF NOT EXISTS friendships_user_high_idx ON friendships (user_high);

CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES profiles (id),
  blocked_id TEXT NOT NULL REFERENCES profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);

DROP TABLE IF EXISTS friend_profile_cache;

-- ============ Spaces: visibility columns (always) ============

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_account_id TEXT;
-- Profile display is always read from `profiles` via host_member_id — never
-- duplicate username/avatar onto the space row.
ALTER TABLE spaces DROP COLUMN IF EXISTS host_username;
ALTER TABLE spaces DROP COLUMN IF EXISTS host_avatar_config;

-- Legacy `friends` visibility collapses to private.
UPDATE spaces SET visibility = 'private' WHERE visibility = 'friends';

CREATE INDEX IF NOT EXISTS spaces_visibility_live_idx
  ON spaces (visibility, created_at DESC)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS spaces_host_account_id_idx
  ON spaces (host_account_id)
  WHERE ended_at IS NULL;

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_member_id TEXT;
UPDATE spaces
SET host_member_id = COALESCE(host_account_id, host_id)
WHERE host_member_id IS NULL;
CREATE INDEX IF NOT EXISTS spaces_host_member_id_idx
  ON spaces (host_member_id)
  WHERE ended_at IS NULL;

DROP TABLE IF EXISTS space_invites;
DROP TABLE IF EXISTS space_participations;

-- ============ Spaces: one-shot legacy membership → space_users ============
-- Runs only while `space_memberships` / `space_allowlist` still exist.
-- Fresh installs and already-migrated DBs skip this (no recreate-then-drop).

DO $$
BEGIN
  IF to_regclass('space_memberships') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE space_memberships ADD COLUMN IF NOT EXISTS profile_id TEXT;
  ALTER TABLE space_memberships ADD COLUMN IF NOT EXISTS device_label TEXT;
  ALTER TABLE space_memberships ADD COLUMN IF NOT EXISTS member_id TEXT;

  EXECUTE 'CREATE INDEX IF NOT EXISTS space_memberships_profile_id_idx ON space_memberships (profile_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS space_memberships_member_id_idx ON space_memberships (member_id)';

  UPDATE space_memberships AS sm
  SET left_at = COALESCE(sm.left_at, now())
  WHERE sm.left_at IS NULL
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = sm.guest_id);

  UPDATE spaces AS s
  SET ended_at = COALESCE(s.ended_at, now())
  WHERE s.ended_at IS NULL
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = s.host_id);

  UPDATE space_memberships
  SET member_id = COALESCE(NULLIF(member_id, ''), NULLIF(profile_id, ''), guest_id)
  WHERE member_id IS NULL OR member_id = '';

  BEGIN
    ALTER TABLE space_memberships ALTER COLUMN guest_id DROP NOT NULL;
  EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN others THEN NULL;
  END;

  UPDATE space_memberships
  SET guest_id = COALESCE(NULLIF(guest_id, ''), NULLIF(member_id, ''), NULLIF(profile_id, ''))
  WHERE guest_id IS NULL OR guest_id = '';
END $$;

-- ============ Spaces: space_users ACL (Docs-style) ============
-- Collapses allowlist + membership into one collaborator table.
-- Live seats move to Room DO state; "opened" is local client state.

CREATE TABLE IF NOT EXISTS space_users (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces (id),
  user_id TEXT NOT NULL REFERENCES profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_account_id TEXT NOT NULL,
  UNIQUE (space_id, user_id)
);

CREATE INDEX IF NOT EXISTS space_users_space_id_idx ON space_users (space_id);
CREATE INDEX IF NOT EXISTS space_users_user_id_idx ON space_users (user_id);

-- Migrate allowlist → space_users (same id shape: spaceId:userId).
DO $$
BEGIN
  IF to_regclass('space_allowlist') IS NOT NULL THEN
    INSERT INTO space_users (
      id, space_id, user_id, created_at, created_by_account_id
    )
    SELECT
      a.id,
      a.space_id,
      a.user_id,
      a.created_at,
      a.created_by_account_id
    FROM space_allowlist a
    WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = a.user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Migrate active memberships that lack an ACL row.
DO $$
BEGIN
  IF to_regclass('space_memberships') IS NOT NULL THEN
    INSERT INTO space_users (
      id, space_id, user_id, created_at, created_by_account_id
    )
    SELECT
      sm.space_id || ':' || COALESCE(NULLIF(sm.member_id, ''), NULLIF(sm.profile_id, ''), sm.guest_id),
      sm.space_id,
      COALESCE(NULLIF(sm.member_id, ''), NULLIF(sm.profile_id, ''), sm.guest_id),
      COALESCE(sm.joined_at, now()),
      COALESCE(NULLIF(sm.member_id, ''), NULLIF(sm.profile_id, ''), sm.guest_id)
    FROM space_memberships sm
    WHERE sm.left_at IS NULL
      AND COALESCE(NULLIF(sm.member_id, ''), NULLIF(sm.profile_id, ''), sm.guest_id) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = COALESCE(NULLIF(sm.member_id, ''), NULLIF(sm.profile_id, ''), sm.guest_id)
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Ensure every live space host is on the ACL.
INSERT INTO space_users (
  id, space_id, user_id, created_at, created_by_account_id
)
SELECT
  s.id || ':' || COALESCE(NULLIF(s.host_member_id, ''), NULLIF(s.host_account_id, '')),
  s.id,
  COALESCE(NULLIF(s.host_member_id, ''), NULLIF(s.host_account_id, '')),
  COALESCE(s.created_at, now()),
  COALESCE(NULLIF(s.host_account_id, ''), NULLIF(s.host_member_id, ''))
FROM spaces s
WHERE s.ended_at IS NULL
  AND COALESCE(NULLIF(s.host_member_id, ''), NULLIF(s.host_account_id, '')) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = COALESCE(NULLIF(s.host_member_id, ''), NULLIF(s.host_account_id, ''))
  )
ON CONFLICT (id) DO NOTHING;

-- Drop legacy tables/columns. Lock spaces first (fixed order) to reduce
-- deadlocks with PowerSync replication holding child-table locks.
DO $$
BEGIN
  IF to_regclass('space_memberships') IS NULL
     AND to_regclass('space_allowlist') IS NULL
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'spaces'
         AND column_name = 'active_member_count'
     ) THEN
    RETURN;
  END IF;

  LOCK TABLE spaces IN ACCESS EXCLUSIVE MODE;

  IF to_regclass('space_allowlist') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE space_allowlist IN ACCESS EXCLUSIVE MODE';
  END IF;
  IF to_regclass('space_memberships') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE space_memberships IN ACCESS EXCLUSIVE MODE';
    DROP TRIGGER IF EXISTS space_memberships_fill_legacy_guest_id_trg
      ON space_memberships;
  END IF;

  DROP FUNCTION IF EXISTS space_memberships_fill_legacy_guest_id();

  DROP TABLE IF EXISTS space_allowlist;
  DROP TABLE IF EXISTS space_memberships;

  ALTER TABLE spaces DROP COLUMN IF EXISTS active_member_count;
END $$;
