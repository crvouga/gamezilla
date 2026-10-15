import { HttpAbortError } from '@pkgs/http-client-shared/http-abort-error';
import { observeHttpResponse } from './observe-http-response';

type Phase = 'before' | 'after' | 'open';
type Waiter = { readonly phase: Phase; readonly release: () => void };

/** A crossing-port fault: a request or its acknowledgement cannot get through. */
export class HttpResponseBarrier {
  private phase: Phase = 'before';
  private readonly waiters = new Set<Waiter>();
  private requests = 0;
  private readonly lifetime = new AbortController();

  constructor(readonly admitted = false) {}

  dispose(): void {
    this.lifetime.abort();
  }

  requestsStarted(): number {
    return this.requests;
  }
  acceptWithoutAnswer(): void {
    this.changePhase('after');
  }
  release(): void {
    this.changePhase('open');
  }

  cross(
    work: () => Promise<Response>,
    signal: AbortSignal | null
  ): Promise<Response> {
    const caller =
      signal === null
        ? this.lifetime.signal
        : AbortSignal.any([signal, this.lifetime.signal]);
    const response = this.run(work, caller);
    return this.admitted ? observeHttpResponse(response, caller) : response;
  }

  private async run(
    work: () => Promise<Response>,
    signal: AbortSignal
  ): Promise<Response> {
    this.requests++;
    await this.wait('before', this.admitted ? this.lifetime.signal : signal);
    if ((!this.admitted && signal.aborted) || this.lifetime.signal.aborted)
      throw new HttpAbortError();
    const response = await work();
    try {
      await this.wait('after', signal);
      return response;
    } catch (error) {
      await response.body?.cancel();
      throw error;
    }
  }

  private wait(phase: Phase, signal: AbortSignal | null): Promise<void> {
    if (signal?.aborted) return Promise.reject(new HttpAbortError());
    if (this.phase !== phase) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = (): void => {
        this.waiters.delete(waiter);
        signal?.removeEventListener('abort', abort);
      };
      const abort = (): void => {
        finish();
        reject(new HttpAbortError());
      };
      const waiter: Waiter = {
        phase,
        release: () => {
          finish();
          resolve();
        },
      };
      this.waiters.add(waiter);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }

  private changePhase(phase: Phase): void {
    this.phase = phase;
    for (const waiter of [...this.waiters]) {
      if (waiter.phase !== phase) waiter.release();
    }
  }
}
