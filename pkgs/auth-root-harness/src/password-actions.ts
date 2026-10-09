import { defineAction } from '@pkgs/harness-root-shared/define-action';
import { runClient } from './actor';
import { attachIdentity, startSession } from './model';
import { expectOutcome } from './checks';
import type { AuthSurface } from './types';
import { requireActor } from './types';

export const registerPassword = defineAction({
  name: 'registerPassword',
  act: async (
    s: AuthSurface,
    clientId: string,
    email: string,
    password: string
  ) => {
    const actor = requireActor(s.clients, clientId);
    const known = s.model.passwords.get(email.toLowerCase());
    const outcome = await runClient(actor, () =>
      actor.port.registerWithPassword(email, password)
    );
    if (
      !expectOutcome(
        s,
        'password registration',
        outcome,
        known === undefined ? 'ok' : 'failed'
      )
    )
      return;
    if (outcome.kind !== 'ok') return;
    const session = actor.port.session.getSnapshot().session;
    if (session === null || actor.bearer === null)
      throw new Error('Registration did not establish a session');
    s.model.passwords.set(email.toLowerCase(), {
      userId: session.externalUserId,
      password,
    });
    attachIdentity(s.model, session.externalUserId, {
      provider: 'password',
      sub: session.externalUserId,
      email: email.toLowerCase(),
      verified: false,
      isPrivate: false,
    });
    startSession(s.model, actor.id, {
      userId: session.externalUserId,
      token: actor.bearer,
      nowMs: s.session.ports.clock.now(),
    });
  },
});

export const signInPassword = defineAction({
  name: 'signInPassword',
  act: async (
    s: AuthSurface,
    clientId: string,
    email: string,
    password: string
  ) => {
    const actor = requireActor(s.clients, clientId);
    const expected = s.model.passwords.get(email.toLowerCase());
    const accepted = expected !== undefined && expected.password === password;
    const outcome = await runClient(actor, () =>
      actor.port.signInWithPassword(email, password)
    );
    if (
      !expectOutcome(
        s,
        'password sign-in',
        outcome,
        accepted ? 'ok' : 'failed'
      ) ||
      !accepted
    )
      return;
    const actual = actor.port.session.getSnapshot().session;
    if (actual?.externalUserId !== expected.userId || actor.bearer === null)
      throw new Error('Password reached the wrong account');
    startSession(s.model, actor.id, {
      userId: expected.userId,
      token: actor.bearer,
      nowMs: s.session.ports.clock.now(),
    });
  },
});

export const setupPasswordAccount = defineAction({
  name: 'setupPasswordAccount',
  act: async (
    s: AuthSurface,
    clientId: string,
    email: string,
    password: string
  ) => {
    const actor = requireActor(s.clients, clientId);
    await actor.port.registerWithPassword(email, password);
    const session = actor.port.session.getSnapshot().session;
    const id = session?.externalUserId ?? null;
    if (id === null)
      throw new Error('Registration did not establish a session');
    s.model.passwords.set(email.toLowerCase(), { userId: id, password });
    attachIdentity(s.model, id, {
      provider: 'password',
      sub: id,
      email: email.toLowerCase(),
      verified: false,
      isPrivate: false,
    });
    await actor.port.signOut();
    s.model.sessions.delete(actor.id);
  },
});

export function registeredPasswordAccount(
  s: AuthSurface,
  email: string
): string | null {
  return s.model.passwords.get(email.toLowerCase())?.userId ?? null;
}
