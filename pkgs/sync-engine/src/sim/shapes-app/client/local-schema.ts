import type { LocalDomainSchema } from '../../../client/local-schema-migrate';
import { SHAPES_APP_TABLES, shapesAppSchema } from '../shared/schema';

/** Local SQLite domain schema for shapes-app sim clients. */
export const shapesLocalSchema: LocalDomainSchema = {
  domainSchema: shapesAppSchema,
  cacheTableNames: SHAPES_APP_TABLES,
};
