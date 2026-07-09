import { ClientConfigCol, CLIENT_CONFIG_TABLE } from '../shared/sync-tables';

export const CLIENT_CONFIG_ROW_SQL = `SELECT ${ClientConfigCol.googleWebClientId} AS google_web_client_id
 FROM ${CLIENT_CONFIG_TABLE.tableName}
 WHERE ${ClientConfigCol.id} = ?`;
