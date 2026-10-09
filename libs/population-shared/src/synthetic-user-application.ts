import { Handles } from '@libs/test-ids-shared/handles';
import {
  chessBoardProbeTestId,
  chessBoardPromotionTestId,
  chessBoardSquareTestId,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core-shared/probe';
import type { Clock } from '@pkgs/clock-shared/types';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import type { Random } from '@pkgs/uuid-shared/create-id';
import { createActor } from 'xstate';
import { logOutThroughUi, openMultiplayer } from './application-actions';
import type { ApplicationEvent } from './application-events';
import {
  isMatchParticipant,
  observeAvailableSpaces,
  returnToSpaces,
} from './application-navigation';
import { behaviorStatechart } from './behavior-statechart';
import type { Activity } from './config';
import {
  chooseActivity,
  type Decision,
  type PolicyInputs,
} from './decision-policy';
import { chooseChessMove } from './gameplay-policy';

export class SyntheticUserApplication {
  readonly actor = createActor(behaviorStatechart).start();
  private pendingFen: string | null = null;
  private submittedAt = 0;
  private idleUntil = 0;
  private decision: { inputs: PolicyInputs; selected: Decision } | null = null;
  constructor(
    private readonly driver: Driver,
    private readonly ports: {
      clock: Clock;
      random: Random;
      username: string;
      emit: (event: ApplicationEvent) => void;
    }
  ) {}
  authenticated(): void {
    this.actor.send({ type: 'START' });
    this.actor.send({ type: 'AUTHENTICATED' });
    this.event('Authenticated');
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
    hostingWeight?: number;
  }): Promise<boolean> {
    if (await this.playCurrentGame()) return true;
    const ownSpace = Handles.spaceCard(this.ports.username);
    if (
      (await this.driver.get(Handles.spaceCreate).isVisible()) &&
      (await this.driver.get(ownSpace).isVisible())
    ) {
      await this.driver.get(ownSpace).tap();
      await openMultiplayer(this.driver);
      this.actor.send({ type: 'HOST' });
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
      hostingWeight: context.hostingWeight ?? 0.3,
    };
    const draws: number[] = [];
    const selected = chooseActivity(inputs, () => {
      const draw = this.ports.random();
      draws.push(draw);
      return draw;
    });
    this.decision = { inputs, selected };
    if (selected.activity === 'loggingOut') {
      this.actor.send({ type: 'LOG_OUT' });
      await logOutThroughUi(this.driver);
      this.actor.send({ type: 'STOP' });
      this.event('LoggedOut');
      return false;
    }
    if (inputs.hasQueueEntry) {
      this.actor.send({ type: 'WAIT' });
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
    await this.act(selected);
    return true;
  }
  private async act(decision: Decision): Promise<void> {
    if (await this.tryRematch(decision)) return;
    if (await this.driver.get(Handles.spaceJoin).isVisible()) {
      await this.driver.get(Handles.spaceJoin).tap();
      this.actor.send({ type: 'JOIN' });
      this.event('JoinedSpace', Handles.spaceJoin);
      this.idleUntil = this.ports.clock.now() + 20_000;
      return;
    }
    await openMultiplayer(this.driver);
    if (
      (await this.driver.get('multiplayer-find').isVisible()) &&
      decision.activity !== 'browsing'
    ) {
      this.actor.send({ type: 'READY' });
      await this.driver.get('multiplayer-find').tap();
      this.actor.send({ type: 'WAIT' });
      this.event('EnteredMatchmaking', 'multiplayer-find');
      return;
    }
    if (
      decision.targetControlId !== null &&
      (await this.driver.get(decision.targetControlId).isVisible())
    ) {
      await this.driver.get(decision.targetControlId).tap();
      this.actor.send({ type: 'JOIN' });
      return;
    }
    if (
      (await this.driver.get(Handles.spaceCreate).isVisible()) &&
      (decision.activity === 'hosting' || decision.activity === 'matchmaking')
    ) {
      await this.driver.get(Handles.spaceCreate).tap();
      this.actor.send({ type: 'HOST' });
      this.event('CreatedSpace', Handles.spaceCreate);
      return;
    }
    await returnToSpaces(this.driver);
    this.actor.send({ type: 'BROWSE' });
    this.event('OpenedSpaces', Handles.tabSpaces);
    this.idleUntil = this.ports.clock.now() + 15_000;
  }
  private async tryRematch(decision: Decision): Promise<boolean> {
    if (this.activity() !== 'postGame') return false;
    for (const id of [
      'multiplayer-accept-rematch',
      'multiplayer-offer-rematch',
    ]) {
      if (
        (await this.driver.get(id).isVisible()) &&
        this.ports.random() < 0.35
      ) {
        await this.driver.get(id).tap();
        this.event('RematchRequested', id);
        this.idleUntil = this.ports.clock.now() + 15_000;
        return true;
      }
    }
    if (
      decision.activity === 'matchmaking' &&
      (await this.driver.get('multiplayer-new-opponent').isVisible())
    ) {
      await this.driver.get('multiplayer-new-opponent').tap();
      this.actor.send({ type: 'WAIT' });
      this.event('EnteredMatchmaking', 'multiplayer-new-opponent');
      return true;
    }
    return false;
  }
  private async playCurrentGame(): Promise<boolean> {
    if (
      !(await this.driver.get('multiplayer-game').isVisible()) ||
      !(await isMatchParticipant(this.driver))
    )
      return false;
    const probe = parseChessBoardProbe(
      await this.driver.get(chessBoardProbeTestId('multiplayer-board')).text()
    );
    if (probe.status !== 'playing') {
      if (this.activity() !== 'postGame') {
        if (this.activity() !== 'playing') this.actor.send({ type: 'MATCH' });
        this.actor.send({ type: 'COMPLETE' });
        this.event('GameCompleted');
      }
      return false;
    }
    if (this.activity() !== 'playing') {
      this.actor.send({ type: 'MATCH' });
      this.event('GameStarted');
    }
    if (this.pendingFen !== null && probe.fen !== this.pendingFen) {
      this.pendingFen = null;
      this.actor.send({ type: 'ACKNOWLEDGED' });
    }
    if (probe.interactive) {
      if (this.pendingFen === null) await this.move(probe.fen);
      else if (this.ports.clock.now() - this.submittedAt > 5_000)
        throw new Error(
          'Move acknowledgement requires authoritative reconciliation'
        );
    }
    return true;
  }
  private async move(fen: string): Promise<void> {
    const move = chooseChessMove(fen, this.ports.random);
    if (move === null) return;
    this.actor.send({ type: 'TURN' });
    // Mark uncertainty before the UI gesture, so failure always reconciles against the server.
    this.pendingFen = fen;
    this.submittedAt = this.ports.clock.now();
    await this.driver
      .get(chessBoardSquareTestId('multiplayer-board', move.from))
      .key('enter');
    await this.driver
      .get(chessBoardSquareTestId('multiplayer-board', move.to))
      .key('enter');
    if (
      move.promotion === 'q' ||
      move.promotion === 'r' ||
      move.promotion === 'b' ||
      move.promotion === 'n'
    )
      await this.driver
        .get(chessBoardPromotionTestId('multiplayer-board', move.promotion))
        .tap();
    this.actor.send({ type: 'MOVE' });
    this.event('MoveSubmitted', move.lan, { fen });
  }
  close(): void {
    this.actor.stop();
  }
}
