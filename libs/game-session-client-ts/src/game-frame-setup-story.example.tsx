import {
  type SpaceScreenChromeValue,
  SpaceScreenChromeValueProvider,
} from '@libs/spaces-client-ts/space-screen-chrome';
import type { SpacePerson } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { FrameStory } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import {
  AVERY,
  BOT,
  JORDAN,
  PEOPLE,
  RULE_OPTIONS,
  record,
  seat,
  setup,
  setupSeat,
  status,
} from './game-frame-story.example';
import type {
  FrameSeatChoices,
  FrameSetup,
  FrameSetupSeat,
} from './game-frame-view-types';

/**
 * Story-only fixtures for a custom game being set up: what a host may put
 * in a seat, the seats of the usual lineups, the space around it, and the
 * frame's args while it is configured. Every setup story starts from
 * `FRAME_CONFIGURING` and renders in `FrameSetupStory`.
 */

/** Who is in avery's space, as the people row names them. */
function storyPeople(you: string): readonly SpacePerson[] {
  const face = (id: string, name: string, host = false): SpacePerson => ({
    id,
    kind: 'person',
    name,
    host,
    you: id === you,
    initials: name.slice(0, 2).toUpperCase(),
    tintKey: id,
  });
  return [
    face(PEOPLE.avery, 'avery', true),
    face(PEOPLE.jordan, 'jordan_plays'),
    face(PEOPLE.morgan, 'morgan'),
  ];
}

/** The space around the story: avery hosts; `viewer` is looking. */
export function storyChrome(
  viewer: keyof typeof PEOPLE = 'avery'
): SpaceScreenChromeValue {
  const you = PEOPLE[viewer];
  return {
    spaceId: 'story-space',
    spaceName: 'avery’s space',
    role: viewer === 'avery' ? 'host' : 'guest',
    hostName: 'avery',
    people: storyPeople(you),
    hostOffline: false,
    status: 'ready',
    onBack: fn(),
    backLabel: 'Back to Connect Four',
    menu: [],
    onLeave: fn(),
    onEnd: fn(),
    onInvite: fn(),
    onPersonAction: fn(),
    personCapabilities: [],
    testIds: {},
  };
}

/** A setup story: the frame inside avery's space, seen by `viewer`. */
export function FrameSetupStory(
  props: GameFrameScreenViewProps & {
    readonly viewer?: keyof typeof PEOPLE | undefined;
    readonly setupBoard?: JSX.Element;
  }
): JSX.Element {
  return (
    <SpaceScreenChromeValueProvider value={storyChrome(props.viewer)}>
      <FrameStory {...props} />
    </SpaceScreenChromeValueProvider>
  );
}

/** Everything a host may put in a seat, with two members to invite. */
export const HOST_CHOICES: FrameSeatChoices = {
  localPlayers: true,
  bots: true,
  difficulties: [],
  difficulty: undefined,
  invitees: [
    { person: PEOPLE.avery, plainName: 'avery', disabled: true },
    { person: PEOPLE.jordan, plainName: 'jordan_plays', disabled: false },
    { person: PEOPLE.morgan, plainName: 'morgan', disabled: false },
  ],
};

/** The same choices for a seat a bot holds: its levels, medium chosen. */
export const BOT_CHOICES: FrameSeatChoices = {
  ...HOST_CHOICES,
  difficulties: ['easy', 'medium', 'hard'],
  difficulty: 'medium',
};

export const OPEN_SEAT = seat('black', { kind: 'open' }, 'Open place');

/** The host's own seat: ready, with every choice. */
export const HOST_SEAT: FrameSetupSeat = setupSeat(AVERY, {
  host: true,
  own: true,
  ready: true,
  canLeave: true,
  choices: HOST_CHOICES,
});

/** The bot the host seated opposite. */
export const BOT_SEAT: FrameSetupSeat = setupSeat(BOT, {
  ready: true,
  choices: BOT_CHOICES,
});

/** An invitation out to jordan_plays, as the host sees it. */
export const INVITED_SEAT: FrameSetupSeat = setupSeat(
  seat('black', { kind: 'invitation', person: PEOPLE.jordan }, 'jordan_plays'),
  {
    invitation: {
      mine: false,
      inviter: PEOPLE.avery,
      inviterName: 'avery',
      canAnswer: false,
      canRevoke: true,
    },
    choices: HOST_CHOICES,
  }
);

/** The game's own options and the clock, as the host changes them. */
export const HOST_OPTIONS: NonNullable<FrameSetup['options']> = {
  players: { count: 2, min: 2, max: 4 },
  groups: RULE_OPTIONS,
  position: 'fixture',
  editable: true,
  clock: { minutes: 5, increment: 3 },
};

/**
 * What a host of a two-player game played by turns agrees, as the app
 * gives it: the clock (untimed until chosen), and no other options.
 */
export const HOST_CLOCK_ONLY: NonNullable<FrameSetup['options']> = {
  players: null,
  groups: [],
  position: 'fixture',
  editable: true,
  clock: { minutes: 0, increment: 0 },
};

/** The host set up a bot opponent: every seat is filled and the game can start. */
export const FRAME_CONFIGURING: Partial<GameFrameScreenViewProps> = {
  phase: 'configuring',
  place: { screen: 'lobby' },
  status: status({
    lineup: 'Red circle: avery. Yellow diamond: Bot (medium).',
    description: 'Ready to start.',
    emphasis: 'neutral',
    tone: 'success',
  }),
  setup: setup([HOST_SEAT, BOT_SEAT], { options: HOST_CLOCK_ONLY }),
  play: { ...FRAME_NO_PLAY, canCancel: true },
  record: record([]),
};

/** The host's lineup with the game's options and the clock to agree. */
export const FRAME_WITH_OPTIONS: Partial<GameFrameScreenViewProps> = {
  ...FRAME_CONFIGURING,
  setup: setup([HOST_SEAT, BOT_SEAT], { options: HOST_OPTIONS }),
};

/** A seated guest's view: the host starts, the guest gets ready. */
export const FRAME_GUEST: Partial<GameFrameScreenViewProps> = {
  ...FRAME_CONFIGURING,
  viewerSide: 'black',
  play: FRAME_NO_PLAY,
  setup: setup(
    [
      setupSeat(AVERY, { host: true, ready: true }),
      setupSeat(JORDAN, { visiting: true, own: true, canLeave: true }),
    ],
    {
      start: {
        reason: { kind: 'unready', count: 1 },
        hostStarts: true,
        readiness: { ready: false, blocked: false },
        canStart: false,
      },
    }
  ),
};
