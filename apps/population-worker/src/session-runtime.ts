import { BEHAVIOR_EVENTS } from '@libs/population-shared/behavior-statechart';
import {
  type Checkpoint,
  reconcileCheckpoint,
} from '@libs/population-shared/config';
import {
  type Inspection,
  redactDiagnostic,
  sanitizeDomSnapshot,
} from '@libs/population-shared/inspection';
import { SyntheticUserApplication } from '@libs/population-shared/synthetic-user-application';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';
import { createApplicationInstance } from './application-instance';
import type { SessionInput, SessionOutput } from './session-messages';
import type { WorkerAssignment, WorkerRenewal } from './worker-rpc';

type Instance = Awaited<ReturnType<typeof createApplicationInstance>>;
export class SessionRuntime {
  private instance: Instance | null = null;
  private behavior: SyntheticUserApplication | null = null;
  private renewal: WorkerRenewal | null = null;
  private draining = false;
  private activated = false;
  private stopped = false;
  private timer: unknown;
  private checkpoint: Checkpoint;
  private recovering = false;
  private action: string | null = null;
  private inspectionAt: string | null = null;
  private restoring: Promise<void> | null = null;
  private actions: Inspection['actions'] = [];
  constructor(
    private readonly assignment: WorkerAssignment,
    private readonly origin: string,
    private readonly ports: {
      clock: Clock;
      timers: Timers;
      send: (value: SessionOutput) => void;
    }
  ) {
    this.checkpoint = reconcileCheckpoint(
      assignment.checkpoint,
      ports.clock.now(),
      assignment.lease.userId
    );
  }
  async start(): Promise<void> {
    try {
      await this.restoreTracked();
      this.schedule();
    } catch (error) {
      this.ports.send({
        type: 'checkpoint',
        checkpoint: this.checkpoint,
        action: null,
        error: redactDiagnostic(
          error instanceof Error ? error.message : String(error),
          [this.assignment.password]
        ).slice(0, 512),
      });
      await this.close();
    }
  }
  private async restoreTracked(): Promise<void> {
    this.restoring = this.restore();
    try {
      await this.restoring;
    } finally {
      this.restoring = null;
    }
  }
  receive(value: Exclude<SessionInput, { type: 'start' }>): void {
    if (value.type === 'stop') {
      void this.close();
      return;
    }
    if (value.type === 'activate') {
      this.activated = true;
      return;
    }
    this.renewal = value.renewal;
    this.draining = value.draining;
  }
  private async restore(): Promise<void> {
    this.activated = false;
    const instance = await createApplicationInstance({
      ...this.assignment,
      origin: this.origin,
      route: this.checkpoint.route,
      onError: (error) =>
        this.ports.send({
          type: 'checkpoint',
          checkpoint: this.checkpoint,
          action: this.action,
          error: error.slice(0, 512),
        }),
      onAction: (action) => {
        this.actions = [...this.actions.slice(-49), action];
        this.ports.send({
          type: 'event',
          event: {
            name: 'UiDriverAction',
            activity: this.checkpoint.activity,
            action: action.action,
            context: { outcome: action.outcome },
          },
        });
      },
    });
    if (this.stopped) {
      await instance.close();
      return;
    }
    this.instance = instance;
    const random = createHarnessIds(this.checkpoint.policySeed).random;
    for (let index = 0; index < this.checkpoint.decisions; index += 1) random();
    this.behavior = new SyntheticUserApplication(this.instance.driver, {
      clock: this.ports.clock,
      username: this.assignment.username,
      restoreGame: this.checkpoint.matchId !== null,
      random: () => {
        this.checkpoint.decisions += 1;
        return random();
      },
      emit: (event) => {
        this.action = event.action;
        this.ports.send({ type: 'event', event });
      },
    });
    this.behavior.authenticated();
    if (this.recovering || this.assignment.registered)
      this.lifecycleEvent('SessionRestored');
    this.ports.send({ type: 'authenticated', token: this.instance.token });
  }
  private schedule(): void {
    if (this.stopped) return;
    this.timer = this.ports.timers.setTimeout(() => {
      void this.tick();
    }, this.renewal?.config.actionIntervalMs ??
      this.assignment.config.actionIntervalMs);
  }
  private async tick(): Promise<void> {
    try {
      if (!this.activated || this.instance === null || this.behavior === null)
        return;
      const renewal = this.renewal;
      const expiry = Date.parse(
        renewal?.expiresAt ?? this.assignment.lease.expiresAt
      );
      if (this.ports.clock.now() >= expiry) {
        await this.close();
        return;
      }
      await this.instance.activate();
      const active = await this.behavior.tick({
        paused: renewal?.paused ?? false,
        draining: this.draining,
        elapsedMs: this.ports.clock.now() - this.checkpoint.startedAtMs,
        sessionMs:
          renewal?.config.sessionMs ?? this.assignment.config.sessionMs,
      });
      this.checkpoint = {
        ...this.checkpoint,
        activity: this.behavior.activity(),
        route: this.instance.route(),
        spaceId:
          this.instance.route().match(/\/space\/([0-9a-f-]{36})/i)?.[1] ?? null,
        matchId:
          document
            .querySelector('[data-testid="multiplayer-game"]')
            ?.getAttribute('data-game-id') ?? null,
      };
      this.ports.send({
        type: 'checkpoint',
        checkpoint: this.checkpoint,
        action: this.action,
        error: null,
      });
      await this.inspectAndCommands();
      if (!active) await this.close();
    } catch (error) {
      await this.recover(error);
    } finally {
      this.schedule();
    }
  }
  private async inspectAndCommands(): Promise<void> {
    const instance = this.instance;
    const behavior = this.behavior;
    if (instance === null || behavior === null) return;
    const requestedAt = this.renewal?.inspectionRequestedAt ?? null;
    if (requestedAt !== null && requestedAt !== this.inspectionAt) {
      this.inspectionAt = requestedAt;
      const snapshot = behavior.actor.getSnapshot();
      this.ports.send({
        type: 'inspection',
        requestedAt,
        snapshot: {
          ...sanitizeDomSnapshot(document, [
            this.assignment.password,
            this.instance?.token ?? '',
          ]),
          capturedAtMs: this.ports.clock.now(),
          generation: this.assignment.lease.generation,
          route: instance.route(),
          state: JSON.stringify(snapshot.value),
          transitions: BEHAVIOR_EVENTS.filter((type) => snapshot.can({ type })),
          actions: this.actions,
        },
      });
    }
    for (const command of this.renewal?.commands ?? []) {
      if (command.command === 'restart')
        await this.recover(new Error('Administrative restart'));
      this.ports.send({ type: 'command-completed', operationId: command.id });
    }
  }
  private async recover(error: unknown): Promise<void> {
    if (this.stopped || this.recovering) return;
    this.recovering = true;
    this.lifecycleEvent('SessionInterrupted');
    this.lifecycleEvent('RecoveryStarted');
    this.checkpoint = { ...this.checkpoint, activity: 'recovering' };
    this.ports.send({
      type: 'checkpoint',
      checkpoint: this.checkpoint,
      action: null,
      error: redactDiagnostic(
        error instanceof Error ? error.message : String(error),
        [this.assignment.password, this.instance?.token ?? '']
      ).slice(0, 512),
    });
    try {
      this.behavior?.close();
      await this.instance?.close();
      this.instance = null;
      this.behavior = null;
      await this.restoreTracked();
    } catch {
      await this.close();
    } finally {
      this.recovering = false;
    }
  }
  private lifecycleEvent(
    name: 'SessionInterrupted' | 'RecoveryStarted' | 'SessionRestored'
  ): void {
    this.ports.send({
      type: 'event',
      event: {
        name,
        activity: this.checkpoint.activity,
        action: null,
        context: {},
      },
    });
  }
  async close(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.ports.timers.clearTimeout(this.timer);
    await this.restoring?.catch(() => undefined);
    this.behavior?.close();
    await this.instance?.close();
    this.ports.send({ type: 'closed' });
  }
}
