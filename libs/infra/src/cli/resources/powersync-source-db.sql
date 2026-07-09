-- Idempotent PowerSync source-database setup (Postgres logical replication).
-- Publishes all current and future tables automatically; no per-table list to maintain.
-- (Neon/dev Postgres does not support FOR ALL TABLES IN SCHEMA; FOR ALL TABLES is equivalent
-- while the app uses a single `public` schema.)

DO $$
DECLARE
  synced_table text;
  is_all_tables boolean;
  is_public_schema_pub boolean;
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
    EXECUTE format(
      'ALTER TABLE public.%I REPLICA IDENTITY FULL',
      synced_table
    );
  END LOOP;
END
$$;
