export type InboxApiFetch = (
  path: string,
  init?: RequestInit
) => Promise<Response>;

export type NotificationsClientDeps = {
  readonly apiBaseUrl: string;
  readonly fetchFn: InboxApiFetch;
};

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
