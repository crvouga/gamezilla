import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { createActor } from 'xstate';
import { logOutThroughUi } from './application-actions';
import type { ApplicationEvent } from './application-events';
import {
  isMatchParticipant,
  observeAvailableSpaces,
  returnToSpaces,
} from './application-navigation';
import {
  type BEHAVIOR_EVENTS,
  behaviorStatechart,
} from './behavior-statechart';
import type { Activity } from './config';
import { ContinuousInputPlayer } from './continuous-input-player';
import {
  chooseActivity,
  type Decision,
  type OpponentDemand,
  type PolicyInputs,
} from './decision-policy';
import {
  findOpponentFor,
  gameForPosition,
  openMultiplayer,
} from './game-automation';
import { MovePacing } from './move-pacing';
import type { Persona } from './persona';
import {
  type OpponentStreak,
  streakAfterGame,
  wantsRematch,
} from './rematch-policy';

/** What of its persona a Synthetic User's play follows. */
export type PlayingPersona = Pick<
  Persona,
  | 'thinkingTime'
  | 'skillLevel'
  | 'rematchWeight'
  | 'hostingWeight'
  | 'favoriteGames'
>;
/** How a Synthetic User plays when it was given no persona. */
const DEFAULT_PERSONA: PlayingPersona = {
  thinkingTime: { minMs: 2_000, maxMs: 8_000 },
  skillLevel: 'intermediate',
  rematchWeight: 0.35,
  hostingWeight: 0.3,
  favoriteGames: [],
};
const STRENGTH = {
  beginner: 'easy',
  casual: 'easy',
  intermediate: 'medium',
  strong: 'hard',
} as const;
/** What a Synthetic User remembers of its play from before this application opened. */
export type PlayMemory = {
  readonly previousThinkingMs?: number;
  readonly streak?: OpponentStreak;
};

const MULTIPLAYER_BOARD = Handles.multiplayerBoard;

export class SyntheticUserApplication {
  readonly actor = createActor(behaviorStatechart).start();
  private readonly continuous: ContinuousInputPlayer;
  private pendingPosition: string | null = null;
  private submittedAt = 0;
  private idleUntil = 0;
  private restoringGame: boolean;
  private readonly restoreStartedAt: number;
  private decision: { inputs: PolicyInputs; selected: Decision } | null = null;
  private readonly persona: PlayingPersona;
  private readonly pacing: MovePacing;
  private streak: OpponentStreak | null;
  private streakGame: string | null = null;
  private rematchOffered = false;
  private reserved: readonly string[] = [];
  constructor(
    private readonly driver: Driver,
    private readonly ports: {
      games: readonly GameAutomation<Driver>[];
      clock: Clock;
      random: Random;
      username: string;
      restoreGame?: boolean;
      persona?: PlayingPersona;
      memory?: PlayMemory;
      emit: (event: ApplicationEvent) => void;
    }
  ) {
    this.continuous = new ContinuousInputPlayer(driver, ports);
    this.persona = ports.persona ?? DEFAULT_PERSONA;
    this.pacing = new MovePacing(
      this.persona.thinkingTime,
      ports.random,
      ports.memory?.previousThinkingMs ?? null
    );
    this.streak = ports.memory?.streak ?? null;
    this.restoringGame = ports.restoreGame ?? false;
    this.restoreStartedAt = ports.clock.now();
  }
  authenticated(): void {
    this.transition({ type: 'START' });
    this.transition({ type: 'AUTHENTICATED' });
    this.event('Authenticated');
    if (this.restoringGame) this.transition({ type: 'RECOVER' });
  }
  private transition(event: { type: (typeof BEHAVIOR_EVENTS)[number] }): void {
    const from = JSON.stringify(this.actor.getSnapshot().value);
    this.actor.send(event);
    const to = JSON.stringify(this.actor.getSnapshot().value);
    if (from !== to) this.event('StateTransition', event.type, { from, to });
  }
  activity(): Activity {
    const value = this.actor.getSnapshot().value;
    return (
      typeof value === 'string' ? value : Object.keys(value)[0]
    ) as Activity;
  }
  policyDecision() {
    return this.decision;
  }
  continuousIntervalMs(): number | null {
    return this.continuous.intervalMs();
  }
  /** The games it may choose to play now: any but those people wait in for another. */
  private offeredGames(): readonly GameAutomation<Driver>[] {
    return this.ports.games.filter(
      (game) => !this.reserved.includes(game.rules.id)
    );
  }
  /** When the Synthetic User means to act next, sooner than its usual pace: its next move. */
  nextWakeAt(): number | null {
    return this.pacing.wakeAt();
  }
  /** The opponent it has played most recently, and how many games in a row. */
  opponentStreak(): OpponentStreak | null {
    return this.streak;
  }
  reconciled(): boolean {
    return !this.restoringGame;
  }
  private event(
    name: ApplicationEvent['name'],
    action: string | null = null,
    context: ApplicationEvent['context'] = {}
  ): void {
    this.ports.emit({ name, action, context, activity: this.activity() });
  }
  async tick(context: {
    paused: boolean;
    draining: boolean;
    elapsedMs: number;
    sessionMs: number;
    waitingOpponents?: readonly OpponentDemand[];
    /** Games where people wait for another Synthetic User: left to that one. */
    reservedGames?: readonly string[];
  }): Promise<boolean> {
    const waiting = context.waitingOpponents ?? [];
    this.reserved = context.reservedGames ?? [];
    const preferred = [
      ...waiting.map((demand) => demand.gameId),
      ...this.persona.favoriteGames,
    ];
    await openMultiplayer(
      this.driver,
      this.offeredGames(),
      this.ports.random,
      preferred
    );
    if (await this.playCurrentGame()) return true;
    if (this.restoringGame) {
      if (await this.driver.get(Handles.spaceJoin).isVisible()) {
        await this.driver.get(Handles.spaceJoin).tap();
        await this.driver.get(Handles.spaceJoin).wait('hidden');
      }
      if (this.ports.clock.now() - this.restoreStartedAt > 30_000)
        throw new Error(
          'The ongoing game could not be reconciled through the app'
        );
      return true;
    }
    const ownSpace = Handles.spaceCard(this.ports.username);
    if (
      (await this.driver.get(Handles.spaceCreate).isVisible()) &&
      (await this.driver.get(ownSpace).isVisible())
    ) {
      await this.driver.get(ownSpace).tap();
      await openMultiplayer(
        this.driver,
        this.offeredGames(),
        this.ports.random,
        preferred
      );
      this.transition({ type: 'HOST' });
      this.event('SessionRestored', ownSpace);
      return true;
    }
    const inputs: PolicyInputs = {
      hasActiveMatch: false,
      hasQueueEntry: await this.driver.get('multiplayer-waiting').isVisible(),
      availableSpaces: await observeAvailableSpaces(this.driver),
      paused: context.paused,
      draining: context.draining,
      sessionElapsedMs: context.elapsedMs,
      sessionLimitMs: context.sessionMs,
      hostingWeight: this.persona.hostingWeight,
      waitingOpponents: waiting,
    };
    const draws: number[] = [];
    const selected = chooseActivity(inputs, () => {
      const draw = this.ports.random();
      draws.push(draw);
      return draw;
    });
    this.decision = { inputs, selected };
    if (selected.activity === 'loggingOut') {
      this.transition({ type: 'LOG_OUT' });
      await logOutThroughUi(this.driver);
      this.transition({ type: 'STOP' });
      this.event('LoggedOut');
      return false;
    }
    if (inputs.hasQueueEntry) {
      this.transition({ type: 'WAIT' });
      return true;
    }
    if (this.ports.clock.now() < this.idleUntil) return true;
    this.event('DecisionSelected', selected.activity, {
      availableSpaces: inputs.availableSpaces.length,
      elapsedMs: inputs.sessionElapsedMs,
      hostingWeight: inputs.hostingWeight,
      targetControlId: selected.targetControlId,
      replay: JSON.stringify({ ...inputs, draws, selected }),
    });
    await this.act(selected, preferred);
    return true;
  }
  private async act(
    decision: Decision,
    preferred: readonly string[]
  ): Promise<void> {
    if (await this.tryRematch(decision)) return;
    if (
      decision.game !== undefined &&
      (await findOpponentFor(this.driver, decision.game))
    ) {
      this.transition({ type: 'WAIT' });
      this.event('EnteredMatchmaking', 'multiplayer-find', {
        game: decision.game.gameId,
      });
      return;
    }
    if (await this.driver.get(Handles.spaceJoin).isVisible()) {
      await this.driver.get(Handles.spaceJoin).tap();
      await this.driver.get(Handles.spaceJoin).wait('hidden');
      this.transition({ type: 'JOIN' });
      this.event('JoinedSpace', Handles.spaceJoin);
      await openMultiplayer(
        this.driver,
        this.offeredGames(),
        this.ports.random,
        preferred
      );
      return;
    }
    await openMultiplayer(
      this.driver,
      this.offeredGames(),
      this.ports.random,
      preferred
    );
    // Which game a find screen is for is unknown: while people wait for
    // another Synthetic User, it finds an opponent only where it was sent.
    if (
      this.reserved.length === 0 &&
      (await this.driver.get('multiplayer-find').isVisible()) &&
      decision.activity !== 'browsing'
    ) {
      this.transition({ type: 'READY' });
      await this.driver.get('multiplayer-find').tap();
      this.transition({ type: 'WAIT' });
      this.event('EnteredMatchmaking', 'multiplayer-find');
      return;
    }
    if (
      decision.targetControlId !== null &&
      (await this.driver.get(decision.targetControlId).isVisible())
    ) {
      await this.driver.get(decision.targetControlId).tap();
      this.transition({ type: 'JOIN' });
      return;
    }
    if (
      (await this.driver.get(Handles.spaceCreate).isVisible()) &&
      (decision.activity === 'hosting' || decision.activity === 'matchmaking')
    ) {
      await this.driver.get(Handles.spaceCreate).tap();
      this.transition({ type: 'HOST' });
      this.event('CreatedSpace', Handles.spaceCreate);
      return;
    }
    await returnToSpaces(this.driver);
    this.transition({ type: 'BROWSE' });
    this.event('OpenedSpaces', Handles.tabSpaces);
    this.idleUntil = this.ports.clock.now() + 15_000;
  }
  /**
   * After a game, a Synthetic User answers its opponent's rematch offer at
   * once, accepting by its rematch weight, and may offer one itself; never
   * a fourth game in a row against the same opponent.
   */
  private async tryRematch(decision: Decision): Promise<boolean> {
    if (this.activity() !== 'postGame') return false;
    if (await this.answerRematch()) return true;
    const offer = this.driver.get('multiplayer-offer-rematch');
    if (
      !this.rematchOffered &&
      (await offer.isVisible()) &&
      wantsRematch(this.streak, this.persona.rematchWeight, this.ports.random())
    ) {
      this.rematchOffered = true;
      await offer.tap();
      this.event('RematchRequested', 'multiplayer-offer-rematch');
      this.idleUntil = this.ports.clock.now() + 15_000;
      return true;
    }
    if (
      decision.activity === 'matchmaking' &&
      !(await this.finishedGameReserved()) &&
      (await this.driver.get('multiplayer-new-opponent').isVisible())
    ) {
      await this.driver.get('multiplayer-new-opponent').tap();
      this.transition({ type: 'WAIT' });
      this.event('EnteredMatchmaking', 'multiplayer-new-opponent');
      return true;
    }
    return false;
  }
  /** Whether people wait for another Synthetic User in the game it just finished. */
  private async finishedGameReserved(): Promise<boolean> {
    const position = await this.driver
      .get('multiplayer-game')
      .attribute('data-fen');
    if (position === null) return false;
    return this.reserved.includes(
      gameForPosition(this.ports.games, position).rules.id
    );
  }
  /** An offer waiting for this Synthetic User is accepted or declined, never left. */
  async answerRematch(): Promise<boolean> {
    if (!(await this.driver.get('multiplayer-accept-rematch').isVisible()))
      return false;
    const accept = wantsRematch(
      this.streak,
      this.persona.rematchWeight,
      this.ports.random()
    );
    const id = accept
      ? 'multiplayer-accept-rematch'
      : 'multiplayer-decline-rematch';
    await this.driver.get(id).tap();
    this.event('RematchRequested', id, { accepted: accept });
    return true;
  }
  async continueCurrentGame(): Promise<void> {
    await this.playCurrentGame();
  }
  private async playCurrentGame(): Promise<boolean> {
    if (
      !(await this.driver.get('multiplayer-game').isVisible()) ||
      !(await isMatchParticipant(this.driver))
    ) {
      this.continuous.suspend();
      return false;
    }
    const game = this.driver.get('multiplayer-game');
    const position = await game.attribute('data-fen');
    if (position === null)
      throw new Error('The game position is unavailable in the app');
    // Only a registered game is played; its adapter moves on its turn.
    const automation = gameForPosition(this.ports.games, position);
    if (!(await this.driver.get(MULTIPLAYER_BOARD).isVisible()))
      await this.driver.get(MULTIPLAYER_BOARD).wait('visible');
    this.restoringGame = false;
    if ((await game.attribute('data-outcome')) !== 'ongoing') {
      this.continuous.suspend();
      if (this.activity() !== 'postGame') {
        if (this.activity() !== 'playing') this.transition({ type: 'MATCH' });
        this.transition({ type: 'COMPLETE' });
        this.event('GameCompleted');
      }
      return false;
    }
    if (this.activity() !== 'playing') {
      this.transition({ type: 'MATCH' });
      this.event('GameStarted');
    }
    await this.recordOpponent(await game.attribute('data-game-id'));
    const enabled = (await game.attribute('data-can-move')) === 'true';
    await this.continuous.update(automation.continuous, enabled);
    if (automation.turns === undefined) return true;
    if (this.pendingPosition !== null && position !== this.pendingPosition) {
      this.pendingPosition = null;
      this.transition({ type: 'ACKNOWLEDGED' });
    }
    if (!enabled) this.pacing.idle();
    if (enabled && this.pendingPosition === null) {
      if (this.pacing.ready(position, this.ports.clock.now()))
        await this.move(position);
    } else if (enabled) {
      if (this.ports.clock.now() - this.submittedAt > 5_000)
        throw new Error(
          'Move acknowledgement requires authoritative reconciliation'
        );
    }
    return true;
  }
  private async move(position: string): Promise<void> {
    const automation = gameForPosition(this.ports.games, position).turns;
    if (automation === undefined) return;
    const action = automation.choose(
      position,
      this.ports.random,
      null,
      STRENGTH[this.persona.skillLevel]
    );
    if (action === null) return;
    if (!automation.rules.legal(position).includes(action))
      throw new Error('The automated participant suggested an illegal action');
    this.transition({ type: 'TURN' });
    // Mark uncertainty before the gesture; recovery always reads canonical state.
    this.pendingPosition = position;
    this.submittedAt = this.ports.clock.now();
    await automation.perform(this.driver, MULTIPLAYER_BOARD, action);
    this.transition({ type: 'MOVE' });
    this.pacing.moved();
    this.event('MoveSubmitted', action, {
      position,
      game: automation.rules.id,
    });
  }
  /** A new game counts towards the games in a row against its opponent. */
  private async recordOpponent(gameId: string | null): Promise<void> {
    if (gameId === null || gameId === this.streakGame) return;
    const seat = this.driver.get('multiplayer-seat-far');
    if (!(await seat.isVisible())) return;
    const opponent = await seat.attribute('data-profile-id');
    if (opponent === null) return;
    this.streakGame = gameId;
    this.rematchOffered = false;
    this.streak = streakAfterGame(this.streak, opponent);
  }
  close(): void {
    this.continuous.suspend();
    this.actor.stop();
  }
}
