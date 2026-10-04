/** @jsxImportSource solid-js */

import { afterEach, describe, expect, test } from 'bun:test';
import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom-client/multi-app-solid-dom-session';
import { createMultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom-client/multi-app-solid-dom-session';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
import { isBlankSnapshotHtml } from '@pkgs/ui-testing-solid-dom-shared/serialize-dom-html';
import { createSignal, type JSX, onCleanup } from 'solid-js';
import { createDemoClock, DemoApp, DemoProviders } from './demo-app';

function actorContainer(actorId: string): Element | null {
  return document.querySelector(`[data-actor="${actorId}"]`);
}

describe('createMultiAppSolidDomSession', () => {
  let session: MultiAppSolidDomSession | undefined;

  afterEach(() => {
    session?.dispose();
    session = undefined;
  });

  test('shows one actor at a time and reports focus hooks', () => {
    const events: string[] = [];
    session = createMultiAppSolidDomSession({
      onActorFocus: (id) => events.push(`focus:${id}`),
      onActorBlur: (id) => events.push(`blur:${id}`),
    });
    const harness = createDemoClock();
    const alice = session.mountActor('alice', () => (
      <DemoApp harness={harness} />
    ));
    expect(session.activeActorId()).toBe('alice');
    expect(actorContainer('alice')).not.toBeNull();
    expect(alice.query('email')).not.toBeNull();

    const bob = session.mountActor('bob', () => <DemoApp harness={harness} />);
    expect(session.activeActorId()).toBe('bob');
    expect(actorContainer('alice')).toBeNull();
    expect(actorContainer('bob')).not.toBeNull();
    expect(alice.query('email')).toBeNull();
    expect(bob.query('email')).not.toBeNull();
    expect(events).toEqual(['focus:alice', 'blur:alice', 'focus:bob']);
  });

  test('drivers over actor facades refocus their actor before acting', async () => {
    session = createMultiAppSolidDomSession();
    const live = session;
    const harness = createDemoClock();
    const driverFor = (id: string) =>
      createSolidDomDriver({
        clock: harness.clock,
        pump: harness.pump,
        harness: {
          mount: () =>
            Promise.resolve(
              live.mountActor(id, () => <DemoApp harness={harness} />)
            ),
        },
      });
    const alice = driverFor('alice');
    const bob = driverFor('bob');
    await alice.launch();
    await bob.launch();
    expect(session.activeActorId()).toBe('bob');

    await alice.get('inc').tap();
    expect(session.activeActorId()).toBe('alice');
    await alice.get('count').expect.text('1');

    await bob.get('count').expect.text('0');
    expect(session.activeActorId()).toBe('bob');

    // Parked actors keep running: alice's state survives bob's turn.
    await alice.get('count').expect.text('1');
    await alice.close();
    expect(session.activeActorId()).toBeUndefined();
    await bob.close();
    expect(
      document.querySelector('[data-component="MultiAppHost"]')
    ).toBeNull();
  });

  test('snapshotAllActors captures the active actor and reuses parked HTML', async () => {
    session = createMultiAppSolidDomSession();
    const harness = createDemoClock();
    session.mountActor('alice', () => (
      <DemoProviders harness={harness}>
        <div class="box" data-testid="a">
          <p class="text">{'Alice was here with plenty of copy'}</p>
        </div>
      </DemoProviders>
    ));
    session.mountActor('bob', () => (
      <DemoProviders harness={harness}>
        <div class="box" data-testid="b">
          <p class="text">{'Bob was here with plenty of copy'}</p>
        </div>
      </DemoProviders>
    ));
    const snapshots = await session.snapshotAllActors({
      stylesheetHref: 'frame.css',
    });
    expect([...snapshots.keys()].sort()).toEqual(['alice', 'bob']);
    expect(snapshots.get('alice')).toContain('Alice was here');
    expect(snapshots.get('bob')).toContain('Bob was here');
    expect(snapshots.get('bob')).toContain('href="frame.css"');
    expect(isBlankSnapshotHtml(snapshots.get('alice'))).toBe(false);
    expect(session.activeActorId()).toBe('bob');

    session.clearFocus();
    expect(session.activeActorId()).toBeUndefined();
    expect(actorContainer('bob')).toBeNull();
    const parked = await session.snapshotAllActors();
    expect(parked.get('bob')).toContain('Bob was here');
    expect(parked.get('alice')).toContain('Alice was here');
  });

  test('mounts uncached parked actors for snapshot when nothing is focused', async () => {
    session = createMultiAppSolidDomSession();
    const harness = createDemoClock();
    const [copy, setCopy] = createSignal('');
    session.mountActor('alice', () => (
      <DemoProviders harness={harness}>
        <p class="text">{copy()}</p>
      </DemoProviders>
    ));
    // Blank shell at blur time: nothing is cached.
    session.clearFocus();
    expect((await session.snapshotAllActors()).size).toBe(0);
    setCopy('Alice rendered a real screen this time');
    // Still nothing focused → the actor is mounted just for the snapshot.
    const out = await session.snapshotAllActors();
    expect(out.get('alice')).toContain('Alice rendered');
    expect(session.activeActorId()).toBe('alice');
  });

  test('unmountActor disposes the root and dispose clears everything', () => {
    let disposed = 0;
    session = createMultiAppSolidDomSession();
    const Tracked = (): JSX.Element => {
      onCleanup(() => {
        disposed += 1;
      });
      return <div data-testid="tracked" />;
    };
    const app = session.mountActor('alice', () => <Tracked />);
    session.mountActor('bob', () => <Tracked />);
    // Parking alice does not dispose her root.
    expect(disposed).toBe(0);
    session.unmountActor('bob');
    expect(disposed).toBe(1);
    expect(session.activeActorId()).toBeUndefined();
    expect(app.query('tracked')).toBeNull();
    session.unmountActor('missing');
    session.dispose();
    expect(disposed).toBe(2);
    expect(
      document.querySelector('[data-component="MultiAppHost"]')
    ).toBeNull();
    expect(() => session?.mountActor('alice', () => <Tracked />)).not.toThrow();
  });
});
