-- Idempotent PowerSync source-database setup (Postgres logical replication).
-- Publishes all current and future tables automatically; no per-table list to maintain.
-- (Neon/dev Postgres does not support FOR ALL TABLES IN SCHEMA; FOR ALL TABLES is equivalent
-- while the app uses a single `public` schema.)
--
-- Replica identity:
--   FULL — preferred so DELETE/UPDATE WAL includes full old rows for PowerSync.
--   DEFAULT — required when the table has a STORED generated column that is not in the
--             publication column list. Postgres 42P10: "cannot update table … Replica
--             identity must not contain unpublished generated columns." (see profiles.username_norm)

DO $$
DECLARE
  synced_table text;
  is_all_tables boolean;
  is_public_schema_pub boolean;
  has_generated boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    CREATE PUBLICATION powersync FOR ALL TABLES;
  ELSE
    SELECT puballtables
    INTO is_all_tables
    FROM pg_publication
    WHERE pubname = 'powersync';

    SELECT EXISTS (
      SELECT 1
      FROM pg_publication p
      JOIN pg_publication_namespace pn ON pn.pnpubid = p.oid
      JOIN pg_namespace n ON n.oid = pn.pnnspid
      WHERE p.pubname = 'powersync'
        AND n.nspname = 'public'
    ) INTO is_public_schema_pub;

    IF NOT COALESCE(is_all_tables, false) AND NOT is_public_schema_pub THEN
      DROP PUBLICATION powersync;
      CREATE PUBLICATION powersync FOR ALL TABLES;
      RAISE NOTICE 'powersync setup: converted publication to FOR ALL TABLES';
    END IF;
  END IF;

  FOR synced_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = synced_table
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attgenerated <> ''
    ) INTO has_generated;

    IF has_generated THEN
      EXECUTE format(
        'ALTER TABLE public.%I REPLICA IDENTITY DEFAULT',
        synced_table
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I REPLICA IDENTITY FULL',
        synced_table
      );
    END IF;
  END LOOP;
END
$$;
