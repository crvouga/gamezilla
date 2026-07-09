-- Idempotent: move legacy app tables from custom `gamezilla` schema to `public`.
-- Safe to re-run on every migrate.

DO $$
DECLARE
  legacy_table record;
BEGIN
  CREATE SCHEMA IF NOT EXISTS public;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'gamezilla') THEN
    RETURN;
  END IF;

  FOR legacy_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'gamezilla'
    ORDER BY tablename
  LOOP
    IF to_regclass(format('public.%I', legacy_table.tablename)) IS NULL THEN
      EXECUTE format(
        'ALTER TABLE gamezilla.%I SET SCHEMA public',
        legacy_table.tablename
      );
      RAISE NOTICE 'migrated gamezilla.% to public.%',
        legacy_table.tablename,
        legacy_table.tablename;
    ELSE
      RAISE NOTICE 'skipped gamezilla.% (public.% already exists)',
        legacy_table.tablename,
        legacy_table.tablename;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'gamezilla'
  ) THEN
    DROP SCHEMA IF EXISTS gamezilla;
  END IF;
END
$$;
