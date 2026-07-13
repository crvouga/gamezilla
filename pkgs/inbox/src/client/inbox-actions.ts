export type InboxApiFetch = (
  path: string,
  init?: RequestInit
) => Promise<Response>;

export type InboxClientDeps = {
  readonly apiBaseUrl: string;
  readonly fetchFn: InboxApiFetch;
};

async function inboxApiJson<T>(opts: {
  deps: InboxClientDeps;
  path: string;
  init?: RequestInit;
}): Promise<T> {
  const url = `${opts.deps.apiBaseUrl}/api/inbox${opts.path}`;
  const response = await opts.deps.fetchFn(url, {
    ...opts.init,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `Inbox API ${opts.path} failed: ${String(response.status)}`
    );
  }
  return (await response.json()) as T;
}

export async function markInteractionReadRemote(
  deps: InboxClientDeps,
  interactionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/interactions/${encodeURIComponent(interactionId)}/read`,
    init: { method: 'POST' },
  });
}

export async function markAllInteractionsReadRemote(
  deps: InboxClientDeps
): Promise<void> {
  await inboxApiJson({
    deps,
    path: '/interactions/read-all',
    init: { method: 'POST' },
  });
}

export async function archiveInteractionRemote(
  deps: InboxClientDeps,
  interactionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/interactions/${encodeURIComponent(interactionId)}/archive`,
    init: { method: 'POST' },
  });
}

export async function dismissInteractionRemote(
  deps: InboxClientDeps,
  interactionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/interactions/${encodeURIComponent(interactionId)}/dismiss`,
    init: { method: 'POST' },
  });
}

export async function performInteractionActionRemote(
  deps: InboxClientDeps,
  interactionId: string,
  actionId: string
): Promise<void> {
  await inboxApiJson({
    deps,
    path: `/interactions/${encodeURIComponent(interactionId)}/actions/${encodeURIComponent(actionId)}`,
    init: { method: 'POST' },
  });
}

export async function backfillInboxRemote(
  deps: InboxClientDeps
): Promise<void> {
  await inboxApiJson({
    deps,
    path: '/backfill',
    init: { method: 'POST' },
  });
}
