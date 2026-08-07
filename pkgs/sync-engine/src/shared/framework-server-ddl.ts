/**
 * Postgres DDL for sync-engine framework tables.
 * Applied via {@link applyFrameworkServerDdl} at migrate time — not owned by
 * domain `defineSchema` / `@pkgs/db-schema`.
 *
 * Server keeps only idempotency + rejection audit. The client mutation queue
 * lives in local SQLite (`_mutations`); it is never written to Postgres.
 */
export const FRAMEWORK_SERVER_DDL = `
-- Legacy client-insert log (never written by current upload path).
DROP TABLE IF EXISTS public._mutations;

-- Mutators framework: server-only idempotency + audit (never synced).
CREATE TABLE IF NOT EXISTS public._mutations_applied (
    mutation_id text NOT NULL,
    client_id text NOT NULL,
    seq bigint NOT NULL,
    status text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT _mutations_applied_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'rejected'::text])))
);

-- Mutators framework: permanent failures synced down by client_id (= device_id).
CREATE TABLE IF NOT EXISTS public.write_rejections (
    id text NOT NULL,
    mutation_id text NOT NULL,
    client_id text NOT NULL,
    code text NOT NULL,
    message text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL
);

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public._mutations_applied
    ADD CONSTRAINT _mutations_applied_pkey PRIMARY KEY (mutation_id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ONLY public.write_rejections
    ADD CONSTRAINT write_rejections_pkey PRIMARY KEY (id)';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS _mutations_applied_client_id_seq_idx ON public._mutations_applied USING btree (client_id, seq);

CREATE INDEX IF NOT EXISTS write_rejections_client_id_idx ON public.write_rejections USING btree (client_id);

CREATE INDEX IF NOT EXISTS write_rejections_mutation_id_idx ON public.write_rejections USING btree (mutation_id);
`;

/** Table names owned by framework DDL (server + local). */
export const FRAMEWORK_TABLE_NAMES = [
  '_mutations',
  '_mutations_applied',
  'write_rejections',
  '_scope_meta',
] as const;

/** Local SQLite durable tables (survive CACHE clear). */
export const FRAMEWORK_DURABLE_TABLE_NAMES = ['_mutations'] as const;

/** Local SQLite cache tables wiped on CACHE clear / epoch bump. */
export const FRAMEWORK_CACHE_TABLE_NAMES = [
  '_scope_meta',
  'write_rejections',
] as const;
