import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MiddlewareHandler } from 'hono';

import { createInboxApp } from './server/app';
import { migrateInbox } from './server/migrate';
import type { InboxRequestContext } from './server/inbox-context';

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

export { migrateInbox } from './server/migrate';
export {
  publishInteraction,
  updateInteraction,
  deactivateInteraction,
} from './server/publish';
export { registerActionHandler } from './server/action-registry';
export { INBOX_ROW_BINDINGS } from './shared/writes/row-bindings';
