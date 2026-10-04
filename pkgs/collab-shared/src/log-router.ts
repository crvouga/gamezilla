import type {
  ComposedMessageRouter,
  MessageRouter,
} from '@pkgs/message-shared/router';

import type { LogLineContext, LogLineDraft } from './log-line';

/**
 * A describe-router projects room events into optional log-line drafts.
 * Handlers return `null` to omit an event from the log.
 *
 * Built on the same {@link createMessageRouter} / {@link createComposedMessageRouter}
 * machinery features already use for command/event routing — register handlers
 * against the same event namespaces.
 */
export type EventLogRouter =
  | MessageRouter<void, LogLineContext, LogLineDraft | null>
  | ComposedMessageRouter<void, LogLineContext, LogLineDraft | null>;
