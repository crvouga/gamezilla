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

CREATE TABLE IF NOT EXISTS space_memberships (
  id TEXT PRIMARY KEY,
  guest_id TEXT,
  space_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS space_memberships_guest_id_idx
  ON space_memberships (guest_id);
CREATE INDEX IF NOT EXISTS space_memberships_space_id_idx
  ON space_memberships (space_id);
CREATE INDEX IF NOT EXISTS space_memberships_joined_at_idx
  ON space_memberships (joined_at ASC);

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

CREATE TABLE IF NOT EXISTS friend_profile_cache (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles (id),
  friend_id TEXT NOT NULL REFERENCES profiles (id),
  username TEXT NOT NULL DEFAULT '',
  avatar_config JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, friend_id)
);

ALTER TABLE friend_profile_cache DROP COLUMN IF EXISTS display_name;

CREATE INDEX IF NOT EXISTS friend_profile_cache_owner_idx
  ON friend_profile_cache (owner_id);

-- ============ Spaces: device-seat membership ============

ALTER TABLE space_memberships ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE space_memberships ADD COLUMN IF NOT EXISTS device_label TEXT;
CREATE INDEX IF NOT EXISTS space_memberships_profile_id_idx
  ON space_memberships (profile_id);

-- Soft-leave / end rows still keyed by account id (users.id). New seats use
-- devices.id. Idempotent: account-keyed active rows become inactive once.
UPDATE space_memberships AS sm
SET left_at = COALESCE(sm.left_at, now())
WHERE sm.left_at IS NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = sm.guest_id);

UPDATE spaces AS s
SET ended_at = COALESCE(s.ended_at, now())
WHERE s.ended_at IS NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = s.host_id);

-- ============ Spaces: visibility + discovery + invites ============

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_account_id TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS active_member_count INTEGER NOT NULL DEFAULT 1;
-- Profile display is always read from `profiles` via host_member_id — never
-- duplicate username/avatar onto the space row.
ALTER TABLE spaces DROP COLUMN IF EXISTS host_username;
ALTER TABLE spaces DROP COLUMN IF EXISTS host_avatar_config;

CREATE INDEX IF NOT EXISTS spaces_visibility_live_idx
  ON spaces (visibility, created_at DESC)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS spaces_host_account_id_idx
  ON spaces (host_account_id)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS space_invites (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces (id),
  kind TEXT NOT NULL,
  token TEXT NOT NULL,
  code TEXT,
  created_by_account_id TEXT NOT NULL,
  invitee_account_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  max_uses INTEGER NOT NULL DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS space_invites_token_uidx
  ON space_invites (token);
CREATE UNIQUE INDEX IF NOT EXISTS space_invites_active_code_uidx
  ON space_invites (code)
  WHERE code IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS space_invites_space_id_idx
  ON space_invites (space_id);
CREATE INDEX IF NOT EXISTS space_invites_invitee_idx
  ON space_invites (invitee_account_id)
  WHERE invitee_account_id IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS space_invites_created_by_idx
  ON space_invites (created_by_account_id);

-- ============ Spaces: user membership + device participation ============

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_member_id TEXT;
UPDATE spaces
SET host_member_id = COALESCE(host_account_id, host_id)
WHERE host_member_id IS NULL;
CREATE INDEX IF NOT EXISTS spaces_host_member_id_idx
  ON spaces (host_member_id)
  WHERE ended_at IS NULL;

ALTER TABLE space_memberships ADD COLUMN IF NOT EXISTS member_id TEXT;

CREATE TABLE IF NOT EXISTS space_participations (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_label TEXT,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS space_participations_space_id_idx
  ON space_participations (space_id);
CREATE INDEX IF NOT EXISTS space_participations_member_id_idx
  ON space_participations (member_id);
CREATE INDEX IF NOT EXISTS space_participations_device_id_idx
  ON space_participations (device_id);
CREATE INDEX IF NOT EXISTS space_participations_left_at_idx
  ON space_participations (left_at);

-- Snapshot active device seats into participations (member = profile or device).
INSERT INTO space_participations (
  id, space_id, member_id, device_id, device_label, joined_at, left_at
)
SELECT
  sm.id,
  sm.space_id,
  COALESCE(NULLIF(sm.profile_id, ''), sm.guest_id),
  sm.guest_id,
  sm.device_label,
  sm.joined_at,
  NULL
FROM space_memberships sm
WHERE sm.left_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM space_participations sp WHERE sp.id = sm.id
  );

-- Soft-leave legacy device-seat memberships so we can recreate user rows.
UPDATE space_memberships
SET left_at = COALESCE(left_at, now())
WHERE left_at IS NULL
  AND id LIKE guest_id || ':%';

-- Recreate one active user membership per (member, space) from participations.
INSERT INTO space_memberships (
  id, guest_id, space_id, joined_at, left_at, profile_id, member_id, device_label
)
SELECT
  p.member_id || ':' || p.space_id,
  p.member_id,
  p.space_id,
  MIN(p.joined_at),
  NULL,
  p.member_id,
  p.member_id,
  NULL
FROM space_participations p
WHERE p.left_at IS NULL
GROUP BY p.member_id, p.space_id
ON CONFLICT (id) DO UPDATE SET
  left_at = NULL,
  member_id = EXCLUDED.member_id,
  profile_id = EXCLUDED.profile_id,
  guest_id = EXCLUDED.guest_id,
  joined_at = COALESCE(space_memberships.joined_at, EXCLUDED.joined_at);

UPDATE space_memberships
SET member_id = COALESCE(NULLIF(member_id, ''), NULLIF(profile_id, ''), guest_id)
WHERE member_id IS NULL OR member_id = '';

CREATE INDEX IF NOT EXISTS space_memberships_member_id_idx
  ON space_memberships (member_id);

-- Client sync writes member_id only (guest_id is legacy). Keep guest_id filled
-- for older SQL, but do not require it on INSERT.
ALTER TABLE space_memberships ALTER COLUMN guest_id DROP NOT NULL;
UPDATE space_memberships
SET guest_id = COALESCE(NULLIF(guest_id, ''), NULLIF(member_id, ''), NULLIF(profile_id, ''))
WHERE guest_id IS NULL OR guest_id = '';

CREATE OR REPLACE FUNCTION space_memberships_fill_legacy_guest_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.guest_id IS NULL OR NEW.guest_id = '' THEN
    NEW.guest_id := COALESCE(NULLIF(NEW.member_id, ''), NULLIF(NEW.profile_id, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS space_memberships_fill_legacy_guest_id_trg
  ON space_memberships;
CREATE TRIGGER space_memberships_fill_legacy_guest_id_trg
  BEFORE INSERT OR UPDATE ON space_memberships
  FOR EACH ROW
  EXECUTE FUNCTION space_memberships_fill_legacy_guest_id();

-- Recount active user memberships per live space.
UPDATE spaces AS s
SET active_member_count = (
  SELECT COUNT(*)::integer
  FROM space_memberships sm
  WHERE sm.space_id = s.id
    AND sm.left_at IS NULL
);

-- Account-only memberships: drop device participation seats.
DROP TABLE IF EXISTS space_participations;
