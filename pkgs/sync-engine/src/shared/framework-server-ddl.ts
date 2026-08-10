/**
 * Postgres DDL for sync-engine framework tables.
 * Applied via {@link applyFrameworkServerDdl} at migrate time — not owned by
 * domain `defineSchema` / `@pkgs/db-schema`.
 *
 * Server keeps only idempotency + rejection audit. The client mutation queue
 * lives in local SQLite (`sync_engine_mutations`); it is never written to Postgres.
 *
 * All framework tables use the `sync_engine_` prefix.
 */

export const SYNC_ENGINE_MUTATIONS = 'sync_engine_mutations';
export const SYNC_ENGINE_MUTATIONS_APPLIED = 'sync_engine_mutations_applied';
export const SYNC_ENGINE_WRITE_REJECTIONS = 'sync_engine_write_rejections';
export const SYNC_ENGINE_SCOPE_META = 'sync_engine_scope_meta';
export const SYNC_ENGINE_PUSH_APPLIED = 'sync_engine_push_applied';
export const SYNC_ENGINE_TOPIC_SEQ = 'sync_engine_topic_seq';

export const FRAMEWORK_SERVER_DDL = `
-- Legacy client-insert log (never written by current upload path).
DROP TABLE IF EXISTS public.sync_engine_mutations;
DROP TABLE IF EXISTS public._mutations;

-- Mutators framework: server-only idempotency + audit (never synced).
CREATE TABLE IF NOT EXISTS public.sync_engine_mutations_applied (
    mutation_id text NOT NULL,
    client_id text NOT NULL,
    seq bigint NOT NULL,
    status text NOT NULL,
    applied_at timestamp with time zone NOT NULL,
    CONSTRAINT sync_engine_mutations_applied_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'rejected'::text])))
);

-- Mutators framework: permanent failures synced down by client_id (= device_id).
CREATE TABLE IF NOT EXISTS public.sync_engine_write_rejections (
    id text NOT NULL,
    mutation_id text NOT NULL,
    client_id text NOT NULL,
    code text NOT NULL,
    message text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL
);

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.sync_engine_mutations_applied
    ADD CONSTRAINT sync_engine_mutations_applied_pkey PRIMARY KEY (mutation_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.sync_engine_write_rejections
    ADD CONSTRAINT sync_engine_write_rejections_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS sync_engine_mutations_applied_client_id_seq_idx ON public.sync_engine_mutations_applied USING btree (client_id, seq);

CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_client_id_idx ON public.sync_engine_write_rejections USING btree (client_id);

CREATE INDEX IF NOT EXISTS sync_engine_write_rejections_mutation_id_idx ON public.sync_engine_write_rejections USING btree (mutation_id);

-- Per-topic monotonic push sequences (replay serialization order).
CREATE TABLE IF NOT EXISTS public.sync_engine_topic_seq (
    topic text NOT NULL,
    n bigint NOT NULL
);

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.sync_engine_topic_seq
    ADD CONSTRAINT sync_engine_topic_seq_pkey PRIMARY KEY (topic)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;
`;

/** Table names owned by framework DDL (server + local). */
export const FRAMEWORK_TABLE_NAMES = [
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_WRITE_REJECTIONS,
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_PUSH_APPLIED,
  SYNC_ENGINE_TOPIC_SEQ,
] as const;

/** Local SQLite durable tables (survive CACHE clear). */
export const FRAMEWORK_DURABLE_TABLE_NAMES = [SYNC_ENGINE_MUTATIONS] as const;

/** Local SQLite cache tables wiped on CACHE clear / epoch bump. */
export const FRAMEWORK_CACHE_TABLE_NAMES = [
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_WRITE_REJECTIONS,
  SYNC_ENGINE_PUSH_APPLIED,
] as const;
