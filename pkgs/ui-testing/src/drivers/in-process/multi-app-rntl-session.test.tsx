import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createElement } from 'react';

import { DemoApp } from './demo-app';
import { createMultiAppRntlSession } from './multi-app-rntl-session';

describe('createMultiAppRntlSession', () => {
  let session: ReturnType<typeof createMultiAppRntlSession>;

  afterEach(() => {
    session?.dispose();
  });

  it('mounts only the active actor shell in the RNTL tree', () => {
    session = createMultiAppRntlSession();
    const alice = session.mountActor('alice', createElement(DemoApp));
    const bob = session.mountActor('bob', createElement(DemoApp));

    expect(session.activeActorId()).toBe('bob');
    expect(bob.query('email')).not.toBeNull();
    expect(alice.query('email')).toBeNull();
  });

  it('returns null from an inactive facade until activate()', async () => {
    session = createMultiAppRntlSession();
    const alice = session.mountActor('alice', createElement(DemoApp));
    const bob = session.mountActor('bob', createElement(DemoApp));

    expect(alice.query('email')).toBeNull();
    await alice.activate();
    expect(alice.query('email')).not.toBeNull();
    expect(bob.query('email')).toBeNull();

    await bob.activate();
    expect(alice.query('email')).toBeNull();
  });

  it('focuses each actor for input without manual park/resume', async () => {
    session = createMultiAppRntlSession();
    const alice = session.mountActor('alice', createElement(DemoApp));
    const bob = session.mountActor('bob', createElement(DemoApp));

    await alice.activate();
    const aliceEmail = alice.query('email');
    expect(aliceEmail).not.toBeNull();
    await alice.typeText(aliceEmail!, 'alice@example.com');

    await bob.activate();
    const bobEmail = bob.query('email');
    expect(bobEmail).not.toBeNull();
    await bob.typeText(bobEmail!, 'bob@example.com');

    expect(bob.getText(bobEmail!)).toBe('bob@example.com');
  });

  it('snapshotAllActors captures every mounted actor and restores focus', async () => {
    session = createMultiAppRntlSession();
    session.mountActor('alice', createElement(DemoApp));
    const bob = session.mountActor('bob', createElement(DemoApp));

    await bob.activate();
    await bob.typeText(bob.query('email')!, 'bob@example.com');

    const snapshots = await session.snapshotAllActors();
    expect(snapshots.get('alice')).toBeDefined();
    expect(snapshots.get('bob')).toContain('bob@example.com');
    expect(session.activeActorId()).toBe('bob');
  });

  it('snapshotAllActors does not invoke onActorFocus while cycling actors', async () => {
    const onActorFocus = jest.fn();
    session = createMultiAppRntlSession({ onActorFocus });
    session.mountActor('alice', createElement(DemoApp));
    session.mountActor('bob', createElement(DemoApp));
    onActorFocus.mockClear();

    await session.snapshotAllActors();

    expect(onActorFocus).not.toHaveBeenCalled();
  });

  it('keeps the remaining actor interactive after one unmounts', async () => {
    session = createMultiAppRntlSession();
    const alice = session.mountActor('alice', createElement(DemoApp));
    const bob = session.mountActor('bob', createElement(DemoApp));

    await alice.activate();
    await alice.typeText(alice.query('email')!, 'alice@example.com');
    await bob.unmount();

    await alice.typeText(alice.query('password')!, 'secret');
    const submit = alice.query('submit');
    expect(submit).not.toBeNull();
    await alice.tap(submit!);
    await alice.activate();

    const welcome = alice.query('welcome');
    expect(welcome).not.toBeNull();
    expect(alice.getText(welcome!)).toBe('Welcome alice@example.com');
    expect(alice.query('email')).toBeNull();
  });
});
