import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { SqlClientImplPlanetScale } from '@gamezilla/shared/sql-client/impl-planetscale';
import { createApiHandler } from './api-handler';

export interface Env {
  DATABASE_URL: string;
}

const pubSub = new InMemoryPubSub();
let migrated = false;

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const sqlClient = new SqlClientImplPlanetScale(env.DATABASE_URL);
    await sqlClient.connect();

    const db = new PatchDbImplPostgres(sqlClient);
    if (!migrated) {
      await db.migrate();
      migrated = true;
    }

    const handle = createApiHandler({ db, pubSub });

    return handle(request);
  },
} satisfies ExportedHandler<Env>;
