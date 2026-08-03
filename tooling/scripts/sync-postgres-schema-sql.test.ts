import { describe, expect, it } from 'bun:test';

import {
  canonicalizeSchemaForCompare,
  collapseDumpToIdempotentSql,
  normalizeSchemaDump,
  stabilizeSchemaStatements,
} from './sync-postgres-schema-sql';

describe('normalizeSchemaDump', () => {
  it('strips dump headers, SET lines, and set_config', () => {
    const dump = `--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SELECT pg_catalog.set_config('search_path', '', false);

CREATE TABLE public.devices (
    id text NOT NULL
);

--
-- Name: devices devices_pkey; Type: CONSTRAINT
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);
`;
    const normalized = normalizeSchemaDump(dump);
    expect(normalized).not.toContain('PostgreSQL database dump');
    expect(normalized).not.toContain('SET statement_timeout');
    expect(normalized).not.toContain('set_config');
    expect(normalized).toContain('CREATE TABLE public.devices');
    expect(normalized).toContain('ADD CONSTRAINT devices_pkey');
  });
});

describe('stabilizeSchemaStatements', () => {
  it('orders tables before indexes', () => {
    const dump = `CREATE INDEX IF NOT EXISTS devices_id_idx ON public.devices USING btree (id);

CREATE TABLE public.devices (
    id text NOT NULL
);
`;
    const out = stabilizeSchemaStatements(normalizeSchemaDump(dump));
    const tableAt = out.indexOf('CREATE TABLE');
    const indexAt = out.indexOf('CREATE INDEX');
    expect(tableAt).toBeGreaterThanOrEqual(0);
    expect(indexAt).toBeGreaterThan(tableAt);
  });
});

describe('canonicalizeSchemaForCompare', () => {
  it('ignores constraint names, column order, and NULLS LAST', () => {
    const a = stabilizeSchemaStatements(
      normalizeSchemaDump(`CREATE TABLE public.profiles (
    id text NOT NULL,
    username text DEFAULT ''::text NOT NULL,
    avatar_config jsonb
);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

CREATE INDEX spaces_created_at_idx ON public.spaces USING btree (created_at DESC NULLS LAST);
`)
    );
    const b = stabilizeSchemaStatements(
      normalizeSchemaDump(`CREATE TABLE public.profiles (
    id text NOT NULL,
    avatar_config jsonb,
    username text DEFAULT ''::text NOT NULL
);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_pk PRIMARY KEY (id);

CREATE INDEX spaces_created_at_idx ON public.spaces USING btree (created_at DESC);
`)
    );
    expect(canonicalizeSchemaForCompare(a)).toBe(
      canonicalizeSchemaForCompare(b)
    );
  });
});

describe('collapseDumpToIdempotentSql', () => {
  it('adds IF NOT EXISTS and wraps ADD CONSTRAINT', () => {
    const dump = `CREATE TABLE public.devices (
    id text NOT NULL
);

CREATE INDEX devices_id_idx ON public.devices USING btree (id);

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);
`;
    const collapsed = collapseDumpToIdempotentSql(normalizeSchemaDump(dump));
    expect(collapsed).toContain('CREATE TABLE IF NOT EXISTS');
    expect(collapsed).toContain('CREATE INDEX IF NOT EXISTS');
    expect(collapsed).toContain('DO $$ BEGIN');
    expect(collapsed).toContain('WHEN duplicate_object THEN NULL');
    expect(collapsed).toContain('Collapsed from live secrets-env');
  });
});
