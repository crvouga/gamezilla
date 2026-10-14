export type InboxApiFetch = (
  path: string,
  init?: RequestInit
) => Promise<Response>;

export type NotificationsClientDeps = {
  readonly apiBaseUrl: string;
  readonly fetchFn: InboxApiFetch;
};

/** The inbox refused a choice and said why. Not a missing connection. */
export class InboxRefusal extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'InboxRefusal';
    this.status = status;
  }
}

function explainedRefusal(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch {
    // A body that is not the refusal envelope has nothing to show.
  }
  return '';
}

async function inboxApiJson<T>(opts: {
  deps: NotificationsClientDeps;
  path: string;
  init?: RequestInit;
}): Promise<T> {
  const url = `${opts.deps.apiBaseUrl}/api/notifications${opts.path}`;
  const response = await opts.deps.fetchFn(url, {
    ...opts.init,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const explained = explainedRefusal(body);
    if (response.status < 500 && explained.length > 0) {
      throw new InboxRefusal(response.status, explained);
    }
    throw new Error(
      `Notifications API ${opts.path} failed: ${String(response.status)}${
        body.length > 0 ? ` ${body}` : ''
      }`
    );
  }
  return (await response.json()) as T;
}

export async function markInteractionReadRemote(
  deps: NotificationsClientDeps,
  interactionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/notifications/${encodeURIComponent(interactionId)}/read`,
    init: { method: 'POST' },
  });
}

export async function markAllInteractionsReadRemote(
  deps: NotificationsClientDeps
): Promise<void> {
  await inboxApiJson({
    deps,
    path: '/notifications/read-all',
    init: { method: 'POST' },
  });
}

export async function archiveInteractionRemote(
  deps: NotificationsClientDeps,
  interactionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/notifications/${encodeURIComponent(interactionId)}/archive`,
    init: { method: 'POST' },
  });
}

export async function dismissInteractionRemote(
  deps: NotificationsClientDeps,
  interactionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/notifications/${encodeURIComponent(interactionId)}/dismiss`,
    init: { method: 'POST' },
  });
}

export async function performNotificationActionRemote(
  deps: NotificationsClientDeps,
  interactionId: string,
  actionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/notifications/${encodeURIComponent(interactionId)}/actions/${encodeURIComponent(actionId)}`,
    init: { method: 'POST' },
  });
}

export async function backfillNotificationsRemote_REMOVED(
  deps: NotificationsClientDeps
): Promise<void> {
  await inboxApiJson({
    deps,
    path: '/backfill',
    init: { method: 'POST' },
  });
}
