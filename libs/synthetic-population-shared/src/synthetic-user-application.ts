import { Handles } from '@libs/test-ids-shared/handles';
import type { Clock } from '@pkgs/clock-shared/types';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import type { Random } from '@pkgs/uuid-shared/create-id';
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
import {
  chooseActivity,
  type Decision,
  type PolicyInputs,
} from './decision-policy';
import { gameForPosition, openMultiplayer } from './game-automation';

export class SyntheticUserApplication {
  readonly actor = createActor(behaviorStatechart).start();
  private pendingPosition: string | null = null;
  private submittedAt = 0;
  private idleUntil = 0;
  private restoringGame: boolean;
  private readonly restoreStartedAt: number;
  private decision: { inputs: PolicyInputs; selected: Decision } | null = null;
  constructor(
    private readonly driver: Driver,
    private readonly ports: {
      games: readonly GameAutomation<Driver>[];
      clock: Clock;
      random: Random;
      username: string;
      restoreGame?: boolean;
      emit: (event: ApplicationEvent) => void;
    }
  ) {
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
    hostingWeight?: number;
  }): Promise<boolean> {
    await openMultiplayer(this.driver, this.ports.games, this.ports.random);
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
      await openMultiplayer(this.driver, this.ports.games, this.ports.random);
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
    await this.act(selected);
    return true;
  }
  private async act(decision: Decision): Promise<void> {
    if (await this.tryRematch(decision)) return;
    if (await this.driver.get(Handles.spaceJoin).isVisible()) {
      await this.driver.get(Handles.spaceJoin).tap();
      await this.driver.get(Handles.spaceJoin).wait('hidden');
      this.transition({ type: 'JOIN' });
      this.event('JoinedSpace', Handles.spaceJoin);
      await openMultiplayer(this.driver, this.ports.games, this.ports.random);
      return;
    }
    await openMultiplayer(this.driver, this.ports.games, this.ports.random);
    if (
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
      this.transition({ type: 'WAIT' });
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
    const game = this.driver.get('multiplayer-game');
    const position = await game.attribute('data-fen');
    if (position === null)
      throw new Error('The game position is unavailable in the app');
    const automation = gameForPosition(this.ports.games, position);
    await this.driver.get(automation.boardControl).wait('visible');
    this.restoringGame = false;
    if ((await game.attribute('data-outcome')) !== 'ongoing') {
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
    if (this.pendingPosition !== null && position !== this.pendingPosition) {
      this.pendingPosition = null;
      this.transition({ type: 'ACKNOWLEDGED' });
    }
    if ((await game.attribute('data-can-move')) === 'true') {
      if (this.pendingPosition === null) await this.move(position);
      else if (this.ports.clock.now() - this.submittedAt > 5_000)
        throw new Error(
          'Move acknowledgement requires authoritative reconciliation'
        );
    }
    return true;
  }
  private async move(position: string): Promise<void> {
    const automation = gameForPosition(this.ports.games, position);
    const action = automation.choose(position, this.ports.random);
    if (action === null) return;
    if (!automation.rules.legal(position).includes(action))
      throw new Error('The automated participant suggested an illegal action');
    this.transition({ type: 'TURN' });
    // Mark uncertainty before the gesture; recovery always reads canonical state.
    this.pendingPosition = position;
    this.submittedAt = this.ports.clock.now();
    await automation.perform(this.driver, action);
    this.transition({ type: 'MOVE' });
    this.event('MoveSubmitted', action, {
      position,
      game: automation.rules.id,
    });
  }
  close(): void {
    this.actor.stop();
  }
}
