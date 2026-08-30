import { type AuthCmd, type AuthWorld, appFetch } from './world';

async function applyDevComplete(
  world: AuthWorld,
  cmd: Extract<AuthCmd, { kind: 'devComplete' }>
): Promise<void> {
  const client = world.clients.get(cmd.clientId);
  if (client === undefined) return;
  const res = await appFetch(world, '/auth/oauth/dev/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject: cmd.subject }),
  });
  if (!res.ok) return;
  const body = (await res.json()) as { token?: string };
  client.bearer =
    typeof body.token === 'string'
      ? body.token
      : res.headers.get('set-auth-token');
}

async function applyGoogleStart(
  world: AuthWorld,
  cmd: Extract<AuthCmd, { kind: 'googleStart' }>
): Promise<void> {
  const client = world.clients.get(cmd.clientId);
  if (client === undefined) return;
  const res = await appFetch(world, '/auth/oauth/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'google',
      callbackUrl: cmd.callbackUrl,
    }),
  });
  if (!res.ok) {
    client.pendingAuthUrl = null;
    return;
  }
  const body = (await res.json()) as { authorizationUrl?: string };
  client.pendingAuthUrl = body.authorizationUrl ?? null;
}

async function applyGoogleApprove(
  world: AuthWorld,
  cmd: Extract<AuthCmd, { kind: 'googleApprove' }>
): Promise<void> {
  const client = world.clients.get(cmd.clientId);
  if (client === undefined || client.pendingAuthUrl === null) return;
  const authUrl = new URL(client.pendingAuthUrl);
  const state = authUrl.searchParams.get('state') ?? '';
  const code = world.createId();
  world.googleSubjects.set(code, cmd.subject);
  const res = await appFetch(
    world,
    `/auth/callback/google?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { method: 'GET', redirect: 'manual' }
  );
  const location = res.headers.get('location');
  if (location === null) {
    client.pendingCode = null;
    return;
  }
  client.pendingCode = new URL(location).searchParams.get('code');
  client.pendingAuthUrl = null;
}

async function applySessionExchange(
  world: AuthWorld,
  cmd: Extract<AuthCmd, { kind: 'sessionExchange' }>
): Promise<void> {
  const client = world.clients.get(cmd.clientId);
  if (client === undefined || client.pendingCode === null) return;
  const res = await appFetch(world, '/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: client.pendingCode }),
  });
  client.pendingCode = null;
  if (!res.ok) return;
  const body = (await res.json()) as { token?: string };
  client.bearer =
    typeof body.token === 'string'
      ? body.token
      : res.headers.get('set-auth-token');
}

async function applySignOut(
  world: AuthWorld,
  cmd: Extract<AuthCmd, { kind: 'signOut' }>
): Promise<void> {
  const client = world.clients.get(cmd.clientId);
  if (client === undefined || client.bearer === null) return;
  await appFetch(world, '/auth/sign-out', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${client.bearer}`,
    },
    body: '{}',
  });
  client.bearer = null;
}

export async function applyAuthCmd(
  world: AuthWorld,
  cmd: AuthCmd
): Promise<void> {
  switch (cmd.kind) {
    case 'devComplete':
      await applyDevComplete(world, cmd);
      return;
    case 'googleStart':
      await applyGoogleStart(world, cmd);
      return;
    case 'googleApprove':
      await applyGoogleApprove(world, cmd);
      return;
    case 'sessionExchange':
      await applySessionExchange(world, cmd);
      return;
    case 'signOut':
      await applySignOut(world, cmd);
      return;
    case 'advanceClock':
      world.clock.advance(cmd.ms);
      return;
    case 'stealBearer': {
      const from = world.clients.get(cmd.from);
      const to = world.clients.get(cmd.to);
      if (from === undefined || to === undefined) return;
      to.bearer = from.bearer;
      return;
    }
    case 'setGoogleFault':
      world.googleFault = cmd.fault;
      return;
    default: {
      const _exhaustive: never = cmd;
      void _exhaustive;
    }
  }
}
