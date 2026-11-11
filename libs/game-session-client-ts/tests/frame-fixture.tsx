import type { CustomGamePlace } from '@libs/game-session-client-ts/custom-game-places';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
} from '@libs/game-session-client-ts/game-frame-empty';
import { frameOverlayPhase } from '@libs/game-session-client-ts/game-frame-overlay-view';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from '@libs/game-session-client-ts/game-frame-screen-view';
import type {
  FramePlaySeat,
  FrameRecord,
  FrameSeatChoices,
  FrameSetup,
  FrameSetupSeat,
  FrameStatus,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { stageOverlayOpening } from '@pkgs/turn-game-client-ts/stage-overlay';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

/** A seat while the game is played. */
export function playSeat(
  side: GameSide,
  name: string,
  over: Partial<FramePlaySeat> = {}
): FramePlaySeat {
  return {
    side,
    sideLabel: `${name}'s side`,
    holder: { kind: 'person', person: `${name}-id` },
    plainName: name,
    swatch: { mark: '●' },
    clock: null,
    stat: null,
    state: null,
    standIn: false,
    committed: false,
    choosing: false,
    facts: [],
    deciding: false,
    reclaim: false,
    ...over,
  };
}

/** Everything a host may put in a seat. */
export const HOST_CHOICES: FrameSeatChoices = {
  localPlayers: true,
  bots: true,
  difficulties: [],
  difficulty: undefined,
  invitees: [
    { person: 'avery-id', plainName: 'avery', disabled: true },
    { person: 'jordan-id', plainName: 'jordan', disabled: false },
  ],
};

/** A seat while the game is set up. */
export function setupSeat(
  side: GameSide,
  holder: FrameSetupSeat['holder'],
  plainName: string,
  over: Partial<FrameSetupSeat> = {}
): FrameSetupSeat {
  return {
    side,
    sideLabel: side === 'white' ? 'First side' : 'Second side',
    holder,
    plainName,
    swatch: { mark: side === 'white' ? '●' : '◆' },
    clock: null,
    host: false,
    visiting: false,
    own: false,
    ready: false,
    invitation: null,
    canSit: false,
    canLeave: false,
    choices: null,
    ...over,
  };
}

/** A host with a bot opposite: ready, and able to start. */
export function hostSetup(over: Partial<FrameSetup> = {}): FrameSetup {
  return {
    viewerNotice: null,
    takeSeat: null,
    seats: [
      setupSeat('white', { kind: 'person', person: 'avery-id' }, 'avery', {
        host: true,
        own: true,
        ready: true,
        canLeave: true,
        choices: HOST_CHOICES,
      }),
      setupSeat('black', { kind: 'bot', level: 'medium' }, 'Bot (medium)', {
        ready: true,
        choices: {
          ...HOST_CHOICES,
          difficulties: ['easy', 'medium', 'hard'],
          difficulty: 'medium',
        },
      }),
    ],
    privateSetup: null,
    options: null,
    start: {
      reason: null,
      hostStarts: false,
      readiness: { ready: true, blocked: false },
      canStart: true,
    },
    ...over,
  };
}

/** The line about a game played by turns. */
export function status(over: Partial<FrameStatus> = {}): FrameStatus {
  return {
    lineup: 'First side: avery. Second side: jordan.',
    description: 'First side to move.',
    plainTurn: true,
    emphasis: 'yours',
    tone: 'neutral',
    sending: false,
    minutes: 0,
    increment: 0,
    ...over,
  };
}

/** The record of a game played by turns, at its latest move. */
export function record(
  moves: readonly string[],
  over: Partial<FrameRecord> = {}
): FrameRecord {
  return {
    earlier: [],
    selection: 'live',
    turns: true,
    moves,
    perTurn: 2,
    movers: [],
    displayedPly: moves.length,
    error: '',
    history: true,
    ...over,
  };
}

const resolved = async (): Promise<void> => undefined;

/**
 * A two-seat game in play, the viewer to move, on the play place. Over the
 * board lies what the stage's machine opens with at the game's phase (the
 * result card once it is over), unless `over` says otherwise.
 */
export function frameProps(
  over: Partial<GameFrameScreenViewProps> = {}
): GameFrameScreenViewProps {
  return {
    title: 'Counting race',
    phase: 'active',
    place: { screen: 'play' },
    viewerSide: 'white',
    watchers: 0,
    connection: 'online',
    error: '',
    stopped: false,
    status: status(),
    canCreate: true,
    playerCount: 2,
    setup: null,
    table: {
      shape: 'strip',
      near: playSeat('white', 'avery', { deciding: true }),
      others: [playSeat('black', 'jordan')],
    },
    play: { ...FRAME_NO_PLAY, canOfferDraw: true, canResign: true },
    result: null,
    next: FRAME_NO_NEXT,
    record: record(['1', '2', '3']),
    board: <output data-testid="story-board" />,
    onChoose: resolved,
    onReady: resolved,
    onPlayBot: resolved,
    onRandomSetup: resolved,
    onBack: () => undefined,
    onSeek: () => undefined,
    onReturnLive: () => undefined,
    onSelectRecord: () => undefined,
    onOpenHistory: () => undefined,
    onOpen: () => undefined,
    onClose: () => undefined,
    overlay: stageOverlayOpening(frameOverlayPhase(over.phase ?? 'active')),
    onOverlay: () => undefined,
    ...over,
  };
}

/** A game being set up by its host, on `place`. */
export function setupProps(
  place: CustomGamePlace = { screen: 'lobby' },
  over: Partial<GameFrameScreenViewProps> = {}
): GameFrameScreenViewProps {
  return frameProps({
    phase: 'configuring',
    place,
    status: status({ description: 'Ready to start.', emphasis: 'neutral' }),
    setup: hostSetup(),
    play: { ...FRAME_NO_PLAY, canCancel: true },
    record: record([]),
    ...over,
  });
}

/** Mount the frame at a phone's width (390) or a desktop's (1440). */
export function mountFrame(
  props: () => GameFrameScreenViewProps,
  width: 390 | 1440 = 390
) {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width, height: width === 390 ? 844 : 900 }}
      >
        <SurfaceStackProvider>
          <GameFrameScreenView {...props()} />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}
