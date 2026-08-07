import type { SqlClient } from '@pkgs/sql-client/interface';
import { InboxError } from '../shared/inbox-errors';
import type { Interaction } from '../shared/interaction';

export type InteractionActionContext = {
  readonly sql: SqlClient;
  readonly actorId: string;
  readonly interaction: Interaction;
  readonly actionId: string;
};

export type InteractionActionHandler = (
  ctx: InteractionActionContext
) => Promise<void>;

const handlers = new Map<string, InteractionActionHandler>();

export function registerActionHandler(
  namespace: string,
  handler: InteractionActionHandler
): void {
  handlers.set(namespace, handler);
}

export function clearActionHandlersForTests(): void {
  handlers.clear();
}

export async function dispatchInteractionAction(
  ctx: InteractionActionContext
): Promise<void> {
  const handler = handlers.get(ctx.interaction.sourceNamespace);
  if (handler === undefined) {
    throw new InboxError(
      'INBOX_HANDLER_MISSING',
      `No action handler registered for ${ctx.interaction.sourceNamespace}`
    );
  }
  await handler(ctx);
}
