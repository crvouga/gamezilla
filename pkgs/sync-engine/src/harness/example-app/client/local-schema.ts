import type { LocalDomainSchema } from '../../../client/local-schema-migrate';
import { EXAMPLE_APP_TABLES, exampleAppSchema } from '../shared/schema';

/** Local SQLite domain schema for example-app harness clients. */
export const exampleLocalSchema: LocalDomainSchema = {
  domainSchema: exampleAppSchema,
  cacheTableNames: EXAMPLE_APP_TABLES,
};
