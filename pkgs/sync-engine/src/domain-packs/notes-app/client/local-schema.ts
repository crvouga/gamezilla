import type { LocalDomainSchema } from '../../../client/local-schema-migrate';
import { NOTES_APP_TABLES, notesAppSchema } from '../shared/schema';

/** Local SQLite domain schema for notes-app sim clients. */
export const notesLocalSchema: LocalDomainSchema = {
  domainSchema: notesAppSchema,
  cacheTableNames: NOTES_APP_TABLES,
};
