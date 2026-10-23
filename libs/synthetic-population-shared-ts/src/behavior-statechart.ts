import { setup } from 'xstate';

export const BEHAVIOR_EVENTS = [
  'START',
  'AUTHENTICATED',
  'BROWSE',
  'HOST',
  'JOIN',
  'WAIT',
  'MATCH',
  'TURN',
  'MOVE',
  'ACKNOWLEDGED',
  'READY',
  'COMPLETE',
  'RECOVER',
  'RESTORED',
  'LOG_OUT',
  'STOP',
  'FAIL',
] as const;

/** Lifecycle only: game decisions are a separate Decision Policy. */
export const behaviorStatechart = setup({
  types: {
    events: {} as { type: (typeof BEHAVIOR_EVENTS)[number] },
  },
}).createMachine({
  id: 'synthetic-user',
  initial: 'offline',
  on: { FAIL: '.recovering', RECOVER: '.recovering', STOP: '.offline' },
  states: {
    offline: { on: { START: 'authenticating', RECOVER: 'recovering' } },
    authenticating: { on: { AUTHENTICATED: 'browsing' } },
    browsing: {
      on: {
        HOST: 'hosting',
        JOIN: 'joining',
        WAIT: 'matchmaking',
        MATCH: 'playing',
        LOG_OUT: 'loggingOut',
      },
    },
    hosting: {
      initial: 'opening',
      states: {
        opening: { on: { READY: 'ready', BROWSE: '#synthetic-user.browsing' } },
        ready: {},
      },
      on: {
        WAIT: 'matchmaking',
        MATCH: 'playing',
        LOG_OUT: 'loggingOut',
        BROWSE: 'browsing',
      },
    },
    joining: {
      on: {
        BROWSE: 'browsing',
        MATCH: 'playing',
        WAIT: 'matchmaking',
        LOG_OUT: 'loggingOut',
      },
    },
    matchmaking: {
      on: { MATCH: 'playing', BROWSE: 'browsing', LOG_OUT: 'loggingOut' },
    },
    playing: {
      initial: 'observing',
      states: {
        observing: { on: { TURN: 'choosing' } },
        choosing: { on: { MOVE: 'awaitingAcknowledgement' } },
        awaitingAcknowledgement: { on: { ACKNOWLEDGED: 'observing' } },
      },
      on: { COMPLETE: 'postGame' },
    },
    postGame: {
      on: {
        WAIT: 'matchmaking',
        BROWSE: 'browsing',
        MATCH: 'playing',
        LOG_OUT: 'loggingOut',
      },
    },
    recovering: {
      on: {
        RESTORED: 'browsing',
        MATCH: 'playing',
        WAIT: 'matchmaking',
        START: 'authenticating',
      },
    },
    loggingOut: { on: { STOP: 'offline' } },
  },
});
