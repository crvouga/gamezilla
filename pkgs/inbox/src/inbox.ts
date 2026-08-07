import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MiddlewareHandler } from 'hono';

import { createInboxApp } from './server/app';
import type { InboxRequestContext } from './server/inbox-context';
import { migrateInbox } from './server/migrate';

export type InboxStorage = {
  readonly sqlClient: SqlClient;
};

export type InboxAppOptions = {
  readonly requireAuth: MiddlewareHandler;
  readonly requestContext: () => InboxRequestContext;
};

export class Inbox {
  private readonly storage: InboxStorage;
  private bootPromise: Promise<void> | null = null;

  constructor(storage: InboxStorage) {
    this.storage = storage;
  }

  ready(): Promise<void> {
    if (this.bootPromise === null) {
      this.bootPromise = migrateInbox(this.storage.sqlClient);
    }
    return this.bootPromise;
  }

  app(opts: InboxAppOptions) {
    return createInboxApp({
      requireAuth: opts.requireAuth,
      requestContext: opts.requestContext,
    });
  }
}

export { registerActionHandler } from './server/action-registry';
export { migrateInbox } from './server/migrate';
export {
  deactivateInteraction,
  publishInteraction,
  updateInteraction,
} from './server/publish';
export { INBOX_SERVER_MANAGED } from './shared/writes/row-bindings';
