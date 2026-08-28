import type { LocalDomainSchema } from '../../../../client/local-schema-migrate';
import { ACME_APP_TABLES, acmeAppSchema } from '../shared/schema';

/** Local SQLite domain schema for acme-app sim clients. */
export const acmeLocalSchema: LocalDomainSchema = {
  domainSchema: acmeAppSchema,
  cacheTableNames: ACME_APP_TABLES,
};
