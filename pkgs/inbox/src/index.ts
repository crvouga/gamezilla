export type { InboxAppOptions, InboxStorage } from './inbox';
export {
  deactivateInteraction,
  INBOX_SERVER_MANAGED,
  Inbox,
  InboxDatabaseMigration,
  migrateInbox,
  publishInteraction,
  registerActionHandler,
  updateInteraction,
} from './inbox';
export type {
  InteractionActionContext,
  InteractionActionHandler,
} from './server/action-registry';
export type { InboxRequestContext } from './server/inbox-context';
export type {
  DeactivateInteractionInput,
  InteractionPresentation,
  PublishInteractionInput,
  UpdateInteractionInput,
} from './server/types';
