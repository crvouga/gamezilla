import {
  ClientConfigCol,
  CLIENT_CONFIG_TABLE,
} from '@libs/db/shared/client-config-tables';
import { honey, type Sql } from '@pkgs/sql';

export function clientConfigRowQuery(id: string): Sql {
  return honey({
    select: [[ClientConfigCol.googleWebClientId, 'google_web_client_id']],
    from: CLIENT_CONFIG_TABLE.tableName,
    where: ['=', ClientConfigCol.id, id],
  });
}
