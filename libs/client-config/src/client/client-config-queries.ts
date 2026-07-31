import {
  CLIENT_CONFIG_TABLE,
  ClientConfigCol,
} from '@libs/db/shared/client-config-tables';
import { sqlMap, type Sql } from '@pkgs/sql';

export function clientConfigRowQuery(id: string): Sql {
  return sqlMap({
    select: [[ClientConfigCol.googleWebClientId, 'google_web_client_id']],
    from: CLIENT_CONFIG_TABLE.tableName,
    where: ['=', ClientConfigCol.id, id],
  });
}
