import { afterEach, describe, expect, it } from '@jest/globals';
import { createElement } from 'react';

import { DemoApp } from './demo-app';
import { createMultiAppRntlSession } from './multi-app-rntl-session';

describe('createMultiAppRntlSession', () => {
  let session: ReturnType<typeof createMultiAppRntlSession>;

  afterEach(() => {
    session?.dispose();
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

  it('keeps the remaining actor interactive after one unmounts', async () => {
    session = createMultiAppRntlSession();
    const alice = session.mountActor('alice', createElement(DemoApp));
    const bob = session.mountActor('bob', createElement(DemoApp));

    await alice.activate();
    await alice.typeText(alice.query('email')!, 'alice@example.com');
    bob.unmount();

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
