-- ============ Base schema ============
-- Idempotent Postgres DDL for the PowerSync source database.
-- Collapsed from live secrets-env `dev` + `prd` schemas (2026-08-05).
-- Re-run in full on every deploy. Statements must stay safe to repeat.
-- PowerSync publication remains in libs/infra powersync-source-db.sql.

CREATE TABLE IF NOT EXISTS public.chess_puzzle_interactions (
    id text NOT NULL,
    owner_id text NOT NULL,
    puzzle_id text NOT NULL,
    puzzle_rating integer DEFAULT 0 NOT NULL,
    kind text NOT NULL,
    solve_idx integer DEFAULT 0 NOT NULL,
    uci text,
    correct boolean,
    rating_before integer DEFAULT 0 NOT NULL,
    rating_after integer DEFAULT 0 NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chess_puzzle_load (
    id text NOT NULL,
    source_etag text,
    cursor text,
    finished_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.chess_puzzle_profiles (
    id text NOT NULL,
    owner_id text NOT NULL,
    rating integer DEFAULT 1200 NOT NULL,
    rating_deviation integer DEFAULT 350 NOT NULL,
    last_interaction_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chess_puzzles (
    id text NOT NULL,
    fen text NOT NULL,
    moves text NOT NULL,
    rating integer DEFAULT 0 NOT NULL,
    rating_deviation integer DEFAULT 0 NOT NULL,
    popularity integer DEFAULT 0 NOT NULL,
    nb_plays integer DEFAULT 0 NOT NULL,
    themes jsonb DEFAULT '[]'::jsonb NOT NULL,
    game_url text,
    opening_tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    sync_pool boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_config (
    id text NOT NULL,
    google_web_client_id text
);

CREATE TABLE IF NOT EXISTS public.devices (
    id text NOT NULL,
    created_at timestamp with time zone,
    platform text,
    os_name text,
    os_version text,
    device_model_name text,
    device_brand text,
    device_name text,
    app_version text,
    app_build_number text,
    user_agent text,
    first_seen_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    account_id text,
    user_id text
);

CREATE TABLE IF NOT EXISTS public.entity_store (
    id text NOT NULL,
    namespace text NOT NULL,
    type text NOT NULL,
    external_id text NOT NULL,
    owner_id text,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.external_accounts (
    user_id text NOT NULL,
    provider text NOT NULL,
    external_id text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.friend_requests (
    id text NOT NULL,
    from_user_id text NOT NULL,
    to_user_id text NOT NULL,
    status text NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT friend_requests_no_self CHECK ((from_user_id <> to_user_id)),
    CONSTRAINT friend_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])))
);

CREATE TABLE IF NOT EXISTS public.friendships (
    id text NOT NULL,
    user_low text NOT NULL,
    user_high text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_request_id text,
    CONSTRAINT friendships_canonical CHECK ((user_low < user_high))
);

CREATE TABLE IF NOT EXISTS public.inbox_interactions (
    id text NOT NULL,
    user_id text NOT NULL,
    source_namespace text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    category text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    group_key text,
    title text NOT NULL,
    subtitle text,
    body text,
    icon_key text,
    avatar_fallback_label text,
    avatar_config text,
    deep_link_path text,
    deep_link_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone,
    read_at timestamp with time zone,
    archived_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inbox_interactions_category_check CHECK ((category = ANY (ARRAY['action_required'::text, 'informational'::text, 'system'::text])))
);

CREATE TABLE IF NOT EXISTS public.inbox_preferences (
    user_id text NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inbox_schema_state (
    id integer NOT NULL,
    schema_fingerprint text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text DEFAULT ''::text NOT NULL,
    avatar_config jsonb,
    username_changed_at timestamp with time zone,
    username_norm text GENERATED ALWAYS AS (lower(username)) STORED
);

CREATE TABLE IF NOT EXISTS public.space_users (
    id text NOT NULL,
    space_id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_account_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.spaces (
    id text NOT NULL,
    title text,
    host_id text,
    created_at timestamp with time zone,
    ended_at timestamp with time zone,
    visibility text DEFAULT 'private'::text NOT NULL,
    host_account_id text,
    host_member_id text
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
    id text NOT NULL,
    blocker_id text NOT NULL,
    blocked_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_blocks_no_self CHECK ((blocker_id <> blocked_id))
);

CREATE TABLE IF NOT EXISTS public.users (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.chess_puzzle_interactions
    ADD CONSTRAINT chess_puzzle_interactions_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.chess_puzzle_interactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.chess_puzzle_load
    ADD CONSTRAINT chess_puzzle_load_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.chess_puzzle_load REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.chess_puzzle_profiles
    ADD CONSTRAINT chess_puzzle_profiles_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.chess_puzzle_profiles REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.chess_puzzles
    ADD CONSTRAINT chess_puzzles_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.chess_puzzles REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.client_config
    ADD CONSTRAINT client_config_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.client_config REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.devices REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.entity_store
    ADD CONSTRAINT entity_store_namespace_type_external_id_key UNIQUE (namespace, type, external_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.entity_store
    ADD CONSTRAINT entity_store_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.entity_store REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.external_accounts
    ADD CONSTRAINT external_accounts_provider_external_id_pk PRIMARY KEY (provider, external_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.external_accounts
    ADD CONSTRAINT external_accounts_user_id_provider_key UNIQUE (user_id, provider)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.external_accounts REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_from_user_id_profiles_id_fk FOREIGN KEY (from_user_id) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_to_user_id_profiles_id_fk FOREIGN KEY (to_user_id) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.friend_requests REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_source_request_id_friend_requests_id_fk FOREIGN KEY (source_request_id) REFERENCES public.friend_requests(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_high_profiles_id_fk FOREIGN KEY (user_high) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_low_profiles_id_fk FOREIGN KEY (user_low) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_low_user_high_key UNIQUE (user_low, user_high)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.friendships REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.inbox_interactions
    ADD CONSTRAINT inbox_interactions_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.inbox_interactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.inbox_preferences
    ADD CONSTRAINT inbox_preferences_pkey PRIMARY KEY (user_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.inbox_preferences REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.inbox_schema_state
    ADD CONSTRAINT inbox_schema_state_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.inbox_schema_state REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.kv
    ADD CONSTRAINT kv_pkey PRIMARY KEY (key)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.kv ALTER COLUMN value SET STORAGE MAIN;

ALTER TABLE ONLY public.kv REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.space_users
    ADD CONSTRAINT space_users_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.space_users
    ADD CONSTRAINT space_users_space_id_spaces_id_fk FOREIGN KEY (space_id) REFERENCES public.spaces(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.space_users
    ADD CONSTRAINT space_users_space_id_user_id_key UNIQUE (space_id, user_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.space_users
    ADD CONSTRAINT space_users_user_id_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.space_users REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.spaces REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_profiles_id_fk FOREIGN KEY (blocked_id) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_profiles_id_fk FOREIGN KEY (blocker_id) REFERENCES public.profiles(id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.user_blocks REPLICA IDENTITY FULL;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ONLY public.users REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_at_idx ON public.chess_puzzle_interactions USING btree (at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_owner_id_idx ON public.chess_puzzle_interactions USING btree (owner_id);

CREATE INDEX IF NOT EXISTS chess_puzzle_interactions_puzzle_id_idx ON public.chess_puzzle_interactions USING btree (puzzle_id);

CREATE INDEX IF NOT EXISTS chess_puzzle_profiles_owner_id_idx ON public.chess_puzzle_profiles USING btree (owner_id);

CREATE INDEX IF NOT EXISTS chess_puzzles_popularity_idx ON public.chess_puzzles USING btree (popularity DESC);

CREATE INDEX IF NOT EXISTS chess_puzzles_rating_idx ON public.chess_puzzles USING btree (rating);

CREATE INDEX IF NOT EXISTS chess_puzzles_rating_popularity_idx ON public.chess_puzzles USING btree (rating, popularity DESC);

CREATE INDEX IF NOT EXISTS chess_puzzles_sync_pool_popularity_idx ON public.chess_puzzles USING btree (rating, popularity DESC) WHERE (sync_pool = true);

CREATE INDEX IF NOT EXISTS devices_account_id_idx ON public.devices USING btree (account_id);

CREATE INDEX IF NOT EXISTS devices_id_idx ON public.devices USING btree (id);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON public.devices USING btree (user_id);

CREATE INDEX IF NOT EXISTS entity_store_namespace_owner_idx ON public.entity_store USING btree (namespace, owner_id);

CREATE INDEX IF NOT EXISTS entity_store_namespace_type_idx ON public.entity_store USING btree (namespace, type);

CREATE INDEX IF NOT EXISTS external_accounts_user_id_idx ON public.external_accounts USING btree (user_id);

CREATE INDEX IF NOT EXISTS friend_requests_from_pending_idx ON public.friend_requests USING btree (from_user_id, created_at DESC NULLS LAST) WHERE (status = 'pending'::text);

CREATE INDEX IF NOT EXISTS friend_requests_history_idx ON public.friend_requests USING btree (from_user_id, to_user_id, updated_at DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_uidx ON public.friend_requests USING btree (from_user_id, to_user_id) WHERE (status = 'pending'::text);

CREATE INDEX IF NOT EXISTS friend_requests_to_pending_idx ON public.friend_requests USING btree (to_user_id, created_at DESC NULLS LAST) WHERE (status = 'pending'::text);

CREATE INDEX IF NOT EXISTS friendships_user_high_idx ON public.friendships USING btree (user_high);

CREATE INDEX IF NOT EXISTS friendships_user_low_idx ON public.friendships USING btree (user_low);

CREATE INDEX IF NOT EXISTS inbox_interactions_list_idx ON public.inbox_interactions USING btree (user_id, active, archived_at, priority DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS inbox_interactions_source_uidx ON public.inbox_interactions USING btree (user_id, source_namespace, source_type, source_id);

CREATE INDEX IF NOT EXISTS profiles_username_norm_prefix_idx ON public.profiles USING btree (username_norm text_pattern_ops);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_norm_uidx ON public.profiles USING btree (username_norm) WHERE (username <> ''::text);

CREATE INDEX IF NOT EXISTS space_users_space_id_idx ON public.space_users USING btree (space_id);

CREATE INDEX IF NOT EXISTS space_users_user_id_idx ON public.space_users USING btree (user_id);

CREATE INDEX IF NOT EXISTS spaces_created_at_idx ON public.spaces USING btree (created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS spaces_ended_at_idx ON public.spaces USING btree (ended_at);

CREATE INDEX IF NOT EXISTS spaces_host_account_id_idx ON public.spaces USING btree (host_account_id) WHERE (ended_at IS NULL);

CREATE INDEX IF NOT EXISTS spaces_host_id_idx ON public.spaces USING btree (host_id);

CREATE INDEX IF NOT EXISTS spaces_host_member_id_idx ON public.spaces USING btree (host_member_id) WHERE (ended_at IS NULL);

CREATE INDEX IF NOT EXISTS spaces_visibility_live_idx ON public.spaces USING btree (visibility, created_at DESC NULLS LAST) WHERE (ended_at IS NULL);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_id);

CREATE UNLOGGED TABLE public.kv (
    key text NOT NULL,
    value jsonb NOT NULL,
    last_modified_at timestamp with time zone DEFAULT now() NOT NULL
)
WITH (fillfactor='70', toast_tuple_target='8160', autovacuum_vacuum_scale_factor='0.05', autovacuum_analyze_scale_factor='0.05', autovacuum_vacuum_threshold='100', autovacuum_analyze_threshold='100', autovacuum_vacuum_cost_delay='0');
