/**
 * Idempotent Postgres DDL for Better Auth tables (`auth_*` prefix).
 * Column names use snake_case to match the Drizzle schema in the API adapter.
 */
import type { Logger } from '../logger/logger';
import type { SqlClient } from '../sql-client/interface';

const DDL = `
CREATE TABLE IF NOT EXISTS auth_user (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_key ON auth_user (email);

CREATE TABLE IF NOT EXISTS auth_session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_session_token_key ON auth_session (token);

CREATE TABLE IF NOT EXISTS auth_account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES auth_user (id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth_verification (identifier);
`;

export type BetterAuthDbMigrateArgs = {
  sqlClient: SqlClient;
  logger: Logger;
};

export class BetterAuthDbImplPostgres {
  static async migrateUp(args: BetterAuthDbMigrateArgs): Promise<void> {
    const { sqlClient, logger } = args;
    const statements = DDL.split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    logger.info('better-auth postgres migrate: applying ddl', {
      statementCount: statements.length,
    });
    for (const stmt of statements) {
      await sqlClient.run(stmt);
    }
    logger.info('better-auth postgres migrate: ddl applied');
  }
}
