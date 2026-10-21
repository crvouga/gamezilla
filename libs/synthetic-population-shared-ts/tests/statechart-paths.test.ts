import { expect, test } from 'bun:test';
import {
  type BEHAVIOR_EVENTS,
  behaviorStatechart,
} from '@libs/synthetic-population-shared-ts/behavior-statechart';
import { createActor } from 'xstate';

type Event = (typeof BEHAVIOR_EVENTS)[number];
const paths: readonly { state: string; events: readonly Event[] }[] = [
  { state: 'offline', events: [] },
  { state: 'authenticating', events: ['START'] },
  { state: 'browsing', events: ['START', 'AUTHENTICATED'] },
  { state: 'hosting.opening', events: ['START', 'AUTHENTICATED', 'HOST'] },
  {
    state: 'hosting.ready',
    events: ['START', 'AUTHENTICATED', 'HOST', 'READY'],
  },
  { state: 'joining', events: ['START', 'AUTHENTICATED', 'JOIN'] },
  { state: 'matchmaking', events: ['START', 'AUTHENTICATED', 'WAIT'] },
  { state: 'playing.observing', events: ['START', 'AUTHENTICATED', 'MATCH'] },
  {
    state: 'playing.choosing',
    events: ['START', 'AUTHENTICATED', 'MATCH', 'TURN'],
  },
  {
    state: 'playing.awaitingAcknowledgement',
    events: ['START', 'AUTHENTICATED', 'MATCH', 'TURN', 'MOVE'],
  },
  {
    state: 'postGame',
    events: ['START', 'AUTHENTICATED', 'MATCH', 'COMPLETE'],
  },
  { state: 'recovering', events: ['START', 'FAIL'] },
  { state: 'loggingOut', events: ['START', 'AUTHENTICATED', 'LOG_OUT'] },
];

test.each([...paths])(
  '$state can fail safely, stop, and authenticate again',
  (path) => {
    const actor = createActor(behaviorStatechart).start();
    try {
      for (const type of path.events) actor.send({ type });
      const value = actor.getSnapshot().value;
      const state =
        typeof value === 'string'
          ? value
          : Object.entries(value)
              .map(([parent, child]) => `${parent}.${child}`)
              .join('');
      expect(state).toBe(path.state);
      const before = actor.getSnapshot().value;
      // A move requires a turn and a selected decision. Unsolicited moves
      // cannot advance authentication, matchmaking, or an unacknowledged move.
      if (path.state !== 'playing.choosing') {
        actor.send({ type: 'MOVE' });
        expect(actor.getSnapshot().value).toEqual(before);
      }
      actor.send({ type: 'FAIL' });
      expect(actor.getSnapshot().matches('recovering')).toBe(true);
      actor.send({ type: 'START' });
      expect(actor.getSnapshot().matches('authenticating')).toBe(true);
      actor.send({ type: 'STOP' });
      expect(actor.getSnapshot().matches('offline')).toBe(true);
    } finally {
      actor.stop();
    }
  }
);
