import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import type { IsolatedWorker } from '@pkgs/os-server/wall-isolated-worker';
import type { SessionOutput } from './session-messages';
import { ownership, type WorkerAssignment, type WorkerRpc } from './worker-rpc';

export type ManagedSessionPorts = {
  clock: Clock;
  timers: Timers;
  rpc: WorkerRpc;
  thread: IsolatedWorker;
  log: Logger;
  onClose: () => void;
};
/** A deadline lives outside the application realm and cannot be blocked by it. */
export class ManagedSession {
  private expiryTimer: unknown;
  private closed = false;
  private queue = Promise.resolve();
  private readonly unsubscribe: () => void;
  private readonly unsubscribeError: () => void;
  constructor(
    readonly assignment: WorkerAssignment,
    private readonly version: string,
    private readonly ports: ManagedSessionPorts
  ) {
    this.unsubscribe = ports.thread.subscribe((message) => {
      this.queue = this.queue
        .then(() => this.receive(message as SessionOutput))
        .catch((error: unknown) => {
          ports.log.warn('Synthetic User coordination failed', {
            userId: assignment.lease.userId,
            generation: assignment.lease.generation,
            error: error instanceof Error ? error.message : 'Unknown failure',
          });
          this.abort();
        });
    });
    this.unsubscribeError = ports.thread.onError(() => this.abort());
    this.deadline(assignment.lease.expiresAt);
  }
  start(origin: string): void {
    this.ports.thread.post({
      type: 'start',
      assignment: this.assignment,
      origin,
      version: this.version,
    });
  }
  private deadline(expiresAt: string): void {
    this.ports.timers.clearTimeout(this.expiryTimer);
    this.expiryTimer = this.ports.timers.setTimeout(
      () => this.abort(),
      Math.max(0, Date.parse(expiresAt) - this.ports.clock.now())
    );
  }
  async renew(draining: boolean): Promise<boolean> {
    if (this.closed) return false;
    const response = await this.ports.rpc.renew.$post({
      json: ownership(this.assignment),
    });
    if (this.closed) return false;
    if (response.status !== 200) {
      this.abort();
      return false;
    }
    const { renewal } = await response.json();
    this.deadline(renewal.expiresAt);
    this.ports.thread.post({
      type: 'control',
      renewal,
      draining: draining || renewal.draining,
    });
    return true;
  }
  private async receive(message: SessionOutput): Promise<void> {
    if (this.closed) return;
    const json = ownership(this.assignment);
    const rpc = this.ports.rpc;
    if (message.type === 'sign-in-link-requested') {
      const response = await rpc['take-sign-in-link'].$post({ json });
      const link =
        response.status === 200 ? (await response.json()).link : null;
      if (!this.closed) this.ports.thread.post({ type: 'sign-in-link', link });
    } else if (message.type === 'authenticated') {
      const response = await rpc['bind-account'].$post({
        json: { ...json, token: message.token },
      });
      if (response.status !== 200) {
        this.abort();
        return;
      }
      if (!this.closed) this.ports.thread.post({ type: 'activate' });
    } else if (message.type === 'checkpoint') {
      const response = await rpc.checkpoint.$post({
        json: { ...json, ...message, version: this.version },
      });
      if (response.status !== 200) this.abort();
    } else if (message.type === 'inspection') {
      await rpc.inspection.$post({
        json: {
          ...json,
          snapshot: message.snapshot,
          requestedAt: message.requestedAt,
        },
      });
    } else if (message.type === 'command-completed') {
      await rpc['complete-command'].$post({
        json: { ...json, operationId: message.operationId },
      });
    } else if (message.type === 'event') {
      await rpc.events.$post({
        json: {
          ...json,
          version: this.version,
          name: message.event.name,
          action: message.event.action,
          context: message.event.context,
        },
      });
    } else if (message.type === 'closed') {
      // The realm confirms its application roots and transports have stopped.
      this.stopRealm();
      try {
        await rpc.release.$post({ json });
      } finally {
        this.ports.onClose();
      }
    }
  }
  /** Forced stops leave leases to expire; an uncertain close never releases early. */
  abort(): void {
    if (this.closed) return;
    this.stopRealm();
    this.ports.onClose();
  }
  private stopRealm(): void {
    this.closed = true;
    this.ports.timers.clearTimeout(this.expiryTimer);
    this.unsubscribe();
    this.unsubscribeError();
    this.ports.thread.terminate();
  }
}
