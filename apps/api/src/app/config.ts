import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SecretStore } from '@pkgs/secret-store';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { PatchDbApiConfig } from '@pkgs/patch-db/api';

export type ApiHandlerConfig = {
  readonly secretStore: SecretStore;
  readonly dbScope: PostgresDbScope;
  /** When set, overrides Vault `API_URL` for Better Auth (preview / QA). */
  readonly apiUrlOverride?: string | null;
  /** When set, overrides Vault `DATABASE_URL` for preview / QA. */
  readonly databaseUrlOverride?: string | null;
  /** Vault config binding (`dev` / `prd`) for database safety checks. */
  readonly vaultConfig?: string | null;
  readonly pubSub: PatchDbApiConfig['pubSub'];
  readonly basePath?: string;
  readonly instrumentation?: PatchDbApiConfig['instrumentation'];
  readonly objectStore: ObjectStore;
};
