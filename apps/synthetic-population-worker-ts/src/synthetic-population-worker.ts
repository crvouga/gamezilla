import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { ManagedSession } from './managed-session';
import type { WorkerRpc } from './worker-rpc';

export type WorkerSettings = {
  id: string;
  origin: string;
  version: string;
  capacity: number;
  shutdownMs: number;
};
export type WorkerPorts = {
  clock: Clock;
  timers: Timers;
  rpc: WorkerRpc;
  spawn: () => IsolatedWorker;
  resources: () => {
    memoryBytes: number | null;
    cpuMilliseconds: number | null;
  };
  log: Logger;
};
export class SyntheticPopulationWorker {
  private readonly sessions = new Map<string, ManagedSession>();
  private draining = false;
  private stopped = false;
  private ready = false;
  private leaseFailures = 0;
  private desired = 0;
  private timer: unknown;
  private drainTimer: unknown;
  private finished: (() => void) | null = null;
  private ticking = false;
  private completion: Promise<void> | null = null;
  constructor(
    private readonly settings: WorkerSettings,
    private readonly ports: WorkerPorts
  ) {}
  status() {
    return {
      workerId: this.settings.id,
      version: this.settings.version,
      ready: this.ready && !this.draining,
      draining: this.draining,
      active: this.sessions.size,
      capacity: this.settings.capacity,
      leaseFailures: this.leaseFailures,
      desired: this.desired,
    };
  }
  async start(): Promise<void> {
    await this.tick();
  }
  private schedule(): void {
    if (this.stopped) return;
    this.timer = this.ports.timers.setTimeout(() => {
      void this.tick();
    }, 5_000);
  }
  private async tick(): Promise<void> {
    if (this.ticking || this.stopped) return;
    this.ticking = true;
    try {
      const response = await this.ports.rpc.heartbeat.$post({
        json: {
          workerId: this.settings.id,
          version: this.settings.version,
          capacity: this.settings.capacity,
          draining: this.draining,
          leaseFailures: this.leaseFailures,
          ...this.ports.resources(),
        },
      });
      if (!response.ok)
        throw new Error(
          `Synthetic Population Worker heartbeat refused (${response.status})`
        );
      const { config } = await response.json();
      this.desired = config.desired;
      this.ready = true;
      const results = await Promise.allSettled(
        [...this.sessions.values()].map((session) =>
          session.renew(this.draining)
        )
      );
      for (const result of results)
        if (result.status === 'rejected' || !result.value)
          this.leaseFailures += 1;
      while (
        !this.stopped &&
        !this.draining &&
        this.sessions.size <
          Math.min(this.settings.capacity, config.capacityPerWorker)
      ) {
        const claim = await this.ports.rpc.claim.$post({
          json: { workerId: this.settings.id },
        });
        if (!claim.ok)
          throw new Error(
            `Synthetic Population Controller claim refused (${claim.status})`
          );
        const { assignment } = await claim.json();
        if (assignment === null) break;
        if (this.draining || this.stopped) {
          await this.ports.rpc.release.$post({
            json: {
              userId: assignment.lease.userId,
              workerId: assignment.lease.workerId,
              generation: assignment.lease.generation,
            },
          });
          break;
        }
        const session = new ManagedSession(assignment, this.settings.version, {
          ...this.ports,
          thread: this.ports.spawn(),
          onClose: () => {
            this.sessions.delete(assignment.lease.userId);
            if (this.draining && this.sessions.size === 0) this.finish();
          },
        });
        this.sessions.set(assignment.lease.userId, session);
        session.start(this.settings.origin);
      }
    } catch (error) {
      this.ready = false;
      this.ports.log.warn(
        'Synthetic Population Worker coordination unavailable',
        {
          error: error instanceof Error ? error.message : 'Unknown failure',
        }
      );
    } finally {
      this.ticking = false;
      this.schedule();
    }
  }
  drain(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.completion !== null) return this.completion;
    this.draining = true;
    this.ports.timers.clearTimeout(this.timer);
    const completion = new Promise<void>((resolve) => {
      this.finished = resolve;
    });
    this.completion = completion;
    this.drainTimer = this.ports.timers.setTimeout(() => {
      for (const session of this.sessions.values()) session.abort();
      this.finish();
    }, this.settings.shutdownMs);
    void this.tick();
    if (this.sessions.size === 0) this.finish();
    return completion;
  }
  private finish(): void {
    this.stopped = true;
    this.ready = false;
    this.ports.timers.clearTimeout(this.timer);
    this.ports.timers.clearTimeout(this.drainTimer);
    this.finished?.();
    this.finished = null;
  }
}
