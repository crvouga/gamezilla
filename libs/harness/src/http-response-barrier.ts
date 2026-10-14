import { HttpAbortError } from '@pkgs/http-client-shared/http-abort-error';

type Phase = 'before' | 'after' | 'open';
type Waiter = { readonly phase: Phase; readonly release: () => void };

/** A crossing-port fault: a request or its acknowledgement cannot get through. */
export class HttpResponseBarrier {
  private phase: Phase = 'before';
  private readonly waiters = new Set<Waiter>();
  private requests = 0;

  requestsStarted(): number {
    return this.requests;
  }
  acceptWithoutAnswer(): void {
    this.changePhase('after');
  }
  release(): void {
    this.changePhase('open');
  }

  async cross(
    work: () => Promise<Response>,
    signal: AbortSignal | null
  ): Promise<Response> {
    this.requests++;
    await this.wait('before', signal);
    if (signal?.aborted) throw new HttpAbortError();
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
