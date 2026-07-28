import type { ObjectStore } from '@pkgs/object-store/interface';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SecretStore } from '@pkgs/secret-store';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  readonly authServer: AuthServerPort;
  readonly dbScope: PostgresDbScope;
  /** When set, overrides secret store `API_URL` for preview / QA. */
  readonly apiUrlOverride?: string | null;
  /** When set, overrides secret store `DATABASE_URL` for preview / QA. */
  readonly databaseUrlOverride?: string | null;
  /** Secrets env binding (`dev` / `prd`) for database safety checks. */
  readonly secretsEnv: string;
  readonly objectStore: ObjectStore;
  readonly observability: Observability;
};
