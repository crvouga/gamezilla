import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import {
  isDescribed,
  MAX_DESCRIPTION_LENGTH,
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  pictureType,
  SCREENSHOT_TYPE,
} from '@pkgs/feedback-shared-ts/bug-report';
import type { DebugBuffer } from '@pkgs/feedback-shared-ts/debug-buffer';
import { collectDiagnostics } from '@pkgs/feedback-shared-ts/diagnostics';
import type {
  DebugEvent,
  DiagnosticProvider,
} from '@pkgs/feedback-shared-ts/types';
import type { BugReportNotice } from './copy';
import type { ConnectionPort, ScreenshotPort } from './ports';
import type { SendBugReport, SendOutcome } from './sender';
import type { BugReportStorage, Draft, KeptBugReport } from './storage';

/** `done`: the bug report left the person's hands, sent or kept to send. */
export type BugReportPhase = 'draft' | 'sending' | 'done';

export type BugReportState = {
  readonly open: boolean;
  readonly phase: BugReportPhase;
  readonly description: string;
  readonly screenshots: readonly {
    readonly id: string;
    readonly url: string | null;
  }[];
  /** Pictures chosen and still being saved. */
  readonly adding: number;
  readonly notice: BugReportNotice | null;
  /** Bug reports kept on the device until they can be sent. */
  readonly waiting: number;
};

/** A picture the person chose, read only once it is known to be wanted. */
export type ChosenPicture = {
  readonly contentType: string;
  readonly size: number;
  read(): Promise<Uint8Array>;
};

export type BugReportControllerOptions = {
  readonly storage: BugReportStorage;
  readonly send: SendBugReport;
  readonly screenshot: ScreenshotPort;
  readonly connection: ConnectionPort;
  readonly debug: DebugBuffer;
  readonly providers: () => readonly DiagnosticProvider[];
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: () => string;
};

/** A slow screenshot never keeps a person from reporting. */
export const SCREENSHOT_DEADLINE_MS = 2500;
const DETAILS_DEADLINE_MS = 1500;
export const RETRY_MS = 60_000;
export const MAX_RETRY_MS = 30 * 60_000;
/** How soon after its own midnight a device whose clock runs ahead asks again. */
const LIMIT_RETRY_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const MAX_KEPT_EVENTS = 300;

const INITIAL: BugReportState = {
  open: false,
  phase: 'draft',
  description: '',
  screenshots: [],
  adding: 0,
  notice: null,
  waiting: 0,
};

function withDeadline<T>(
  work: Promise<T>,
  timers: Timers,
  ms: number,
  late: T
): Promise<T> {
  return new Promise((resolve) => {
    const handle = timers.setTimeout(() => resolve(late), ms);
    const finish = (value: T): void => {
      timers.clearTimeout(handle);
      resolve(value);
    };
    work.then(finish, () => finish(late));
  });
}

/** One bug report at a time: its draft, its pictures, and getting it to the team. */
export class BugReportController {
  private current = INITIAL;
  private draft: Draft | null = null;
  private readonly urls = new Map<string, string | null>();
  private readonly listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private sending: Promise<void> | null = null;
  private flushing: Promise<void> | null = null;
  private saveQueued = false;
  private retry: unknown = null;
  /** Grows while the team cannot be reached; past the daily limit it reaches for the next day. */
  private retryMs = RETRY_MS;
  /** Why the bug reports kept on the device last stopped short of the team. */
  private held: 'later' | 'limit' | null = null;
  private disposed = false;
  /** Settles once the draft and waiting bug reports of the last visit are known. */
  readonly ready: Promise<void>;

  constructor(private readonly options: BugReportControllerOptions) {
    this.ready = this.enqueue(() => this.load());
  }

  readonly state = (): BugReportState => this.current;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(change: Partial<BugReportState>): void {
    this.current = { ...this.current, ...change };
    for (const listener of this.listeners) listener();
  }

  /** Changes happen one after another, so none sees another half done. */
  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.queue.then(work).catch(() => undefined);
    this.queue = next;
    return next;
  }

  private async load(): Promise<void> {
    const { storage } = this.options;
    this.draft = await storage.loadDraft();
    this.set({
      description: this.draft.description,
      screenshots: await this.views(),
      waiting: (await storage.waitingIds()).length,
    });
    void this.flush();
  }

  private async views(): Promise<BugReportState['screenshots']> {
    const views = [];
    for (const { id } of this.draft?.screenshots ?? []) {
      if (!this.urls.has(id))
        this.urls.set(id, await this.options.storage.pictureUrl(id));
      views.push({ id, url: this.urls.get(id) ?? null });
    }
    return views;
  }

  private saveSoon(): void {
    if (this.saveQueued) return;
    this.saveQueued = true;
    void this.enqueue(async () => {
      this.saveQueued = false;
      if (this.draft) await this.options.storage.saveDraft(this.draft);
    });
  }

  /** Replaces the app's own screenshot with one of what is showing now. */
  private async takeScreenshot(draft: Draft): Promise<void> {
    const { storage, screenshot, timers } = this.options;
    for (const { id } of draft.screenshots) await storage.deletePicture(id);
    draft.screenshots = [];
    const file = await withDeadline(
      Promise.resolve().then(() => screenshot.capture()),
      timers,
      SCREENSHOT_DEADLINE_MS,
      null
    );
    const contentType = file ? pictureType(file.bytes) : null;
    if (!file || contentType === null) return;
    const id = this.options.createId();
    await storage.putPicture(id, { contentType, bytes: file.bytes });
    draft.screenshots = [{ id, contentType, auto: true }];
  }

  /**
   * Opens the bug report. One the person has not started takes a fresh
   * screenshot and the debug info up to now; one already started keeps what
   * it had, so reporting again never loses a word and the debug info still
   * tells of when the bug happened.
   */
  readonly open = (): Promise<void> =>
    this.enqueue(async () => {
      const draft = this.draft;
      if (this.current.open || !draft || this.disposed) return;
      if (this.current.phase === 'sending') {
        this.set({ open: true });
        return;
      }
      const started =
        draft.description.trim() !== '' ||
        draft.screenshotRemoved === true ||
        draft.screenshots.some((screenshot) => !screenshot.auto);
      if (!started) {
        draft.events = this.options.debug.snapshot();
        await this.takeScreenshot(draft).catch(() => undefined);
      }
      await this.options.storage.saveDraft(draft);
      this.set({
        open: true,
        phase: 'draft',
        notice: null,
        description: draft.description,
        screenshots: await this.views(),
      });
    });

  readonly close = (): void => {
    if (this.current.phase === 'done')
      this.set({ open: false, phase: 'draft', notice: null });
    else this.set({ open: false });
  };

  readonly describe = (description: string): void => {
    if (!this.draft || this.current.phase !== 'draft') return;
    this.draft.description = description.slice(0, MAX_DESCRIPTION_LENGTH);
    this.set({
      description: this.draft.description,
      notice: this.current.notice === 'describe' ? null : this.current.notice,
    });
    this.saveSoon();
  };

  /**
   * Discards the draft: its description and pictures leave the device for
   * good. A bug report already sent or kept to send is not a draft.
   */
  readonly discard = (): Promise<void> => {
    const draft = this.draft;
    if (!draft || this.current.phase !== 'draft') return Promise.resolve();
    return this.enqueue(async () => {
      this.draft = await this.options.storage.clearDraft(draft);
      this.urls.clear();
      this.set({ open: false, description: '', screenshots: [], notice: null });
    });
  };

  /** Pictures still being saved count towards the limit, so two added at once cannot pass it. */
  readonly addPicture = (picture: ChosenPicture): Promise<void> => {
    const draft = this.draft;
    if (!draft || this.current.phase !== 'draft') return Promise.resolve();
    const refusal = this.refusal(picture);
    if (refusal) {
      this.set({ notice: refusal });
      return Promise.resolve();
    }
    this.set({ adding: this.current.adding + 1, notice: null });
    return this.enqueue(async () => {
      try {
        // Discarded while this picture waited its turn: it goes with the draft.
        if (this.draft !== draft) return;
        const bytes = await picture.read();
        // Told from the bytes, as the team will tell it: a name is only a name.
        const contentType = pictureType(bytes);
        if (contentType === null) {
          this.set({ notice: 'not-a-picture' });
          return;
        }
        const id = this.options.createId();
        await this.options.storage.putPicture(id, { contentType, bytes });
        draft.screenshots.push({ id, contentType, auto: false });
        await this.options.storage.saveDraft(draft);
        this.set({ screenshots: await this.views() });
      } catch {
        this.set({ notice: 'failed' });
      } finally {
        this.set({ adding: this.current.adding - 1 });
      }
    });
  };

  private refusal(picture: ChosenPicture): BugReportNotice | null {
    if (!SCREENSHOT_TYPE.test(picture.contentType)) return 'not-a-picture';
    if (
      this.current.screenshots.length + this.current.adding >=
      MAX_SCREENSHOTS
    )
      return 'too-many';
    return picture.size > MAX_SCREENSHOT_BYTES ? 'too-large' : null;
  }

  readonly removeScreenshot = (id: string): void => {
    const draft = this.draft;
    if (!draft || this.current.phase !== 'draft') return;
    draft.screenshots = draft.screenshots.filter((entry) => entry.id !== id);
    draft.screenshotRemoved = true;
    this.set({
      screenshots: this.current.screenshots.filter((entry) => entry.id !== id),
      notice: null,
    });
    void this.enqueue(async () => {
      await this.options.storage.deletePicture(id);
      if (this.draft === draft) await this.options.storage.saveDraft(draft);
    });
  };

  /** Sends the bug report; sending twice at once is one sending. */
  readonly send = (): Promise<void> => {
    if (this.sending !== null) return this.sending;
    if (!this.draft || this.current.phase !== 'draft') return Promise.resolve();
    if (!isDescribed(this.draft.description)) {
      this.set({ notice: 'describe' });
      return Promise.resolve();
    }
    this.set({ phase: 'sending', notice: null });
    this.sending = this.deliver(this.draft).finally(() => {
      this.sending = null;
    });
    return this.sending;
  };

  private async payload(draft: Draft): Promise<KeptBugReport> {
    const { storage, clock, timers, providers, debug } = this.options;
    const pictures = [];
    for (const screenshot of draft.screenshots) {
      const picture = await storage.readPicture(screenshot);
      if (picture) pictures.push(picture);
    }
    return {
      submission: {
        schema: 'bug-report/v1',
        id: draft.reportId,
        reporterId: await storage.reporterId(),
        description: draft.description.trim(),
        createdAt: new Date(clock.now()).toISOString(),
        debugInfo: {
          // What led up to the bug, and what led up to sending it.
          events: mergeEvents(draft.events, debug.snapshot()),
          details: await collectDiagnostics(
            providers(),
            timers,
            DETAILS_DEADLINE_MS
          ),
        },
      },
      pictures,
    };
  }

  private async deliver(draft: Draft): Promise<void> {
    let report: KeptBugReport | null = null;
    // Queued behind every picture still being saved, so none is left behind.
    await this.enqueue(async () => {
      report = await this.payload(draft);
    });
    const ready = report as KeptBugReport | null;
    if (!ready) {
      this.set({ phase: 'draft', notice: 'failed' });
      return;
    }
    const outcome = this.options.connection.online()
      ? await this.sendInTurn(ready)
      : 'offline';
    await this.enqueue(() => this.settle(draft, ready, outcome));
  }

  /** Bug reports kept earlier go first, so the team gets them in the order they were sent. */
  private async sendInTurn(report: KeptBugReport): Promise<SendOutcome> {
    if (this.current.waiting > 0) await this.flush();
    if (this.current.waiting > 0 && this.held !== null) return this.held;
    return this.options.send(report.submission, report.pictures);
  }

  private async settle(
    draft: Draft,
    report: KeptBugReport,
    outcome: SendOutcome | 'offline'
  ): Promise<void> {
    const { storage } = this.options;
    if (outcome === 'failed') {
      this.set({ phase: 'draft', notice: outcome });
      return;
    }
    if (outcome !== 'sent') {
      try {
        await storage.keep(report);
      } catch {
        this.set({ phase: 'draft', notice: 'failed' });
        return;
      }
    }
    this.draft = await storage.clearDraft(draft);
    this.urls.clear();
    this.set({
      phase: 'done',
      notice: outcome,
      description: '',
      screenshots: [],
      waiting: (await storage.waitingIds()).length,
    });
    if (outcome === 'limit') this.retryMs = this.untilLimitStartsAgain();
    this.retrySoon();
  }

  /**
   * The daily limit starts again at midnight UTC, as the team counts days.
   * Asking sooner would only send the screenshots again to be refused, so
   * the device waits for midnight; refused just after its own midnight, its
   * clock may run ahead of the team's, and it asks once more in an hour.
   */
  private untilLimitStartsAgain(): number {
    const sinceMidnight = this.options.clock.now() % DAY_MS;
    return sinceMidnight < LIMIT_RETRY_MS
      ? LIMIT_RETRY_MS
      : DAY_MS - sinceMidnight;
  }

  private retrySoon(): void {
    if (this.retry !== null || this.disposed || this.current.waiting === 0)
      return;
    this.retry = this.options.timers.setTimeout(() => {
      this.retry = null;
      void this.flush();
    }, this.retryMs);
  }

  /** Sends the bug reports kept on the device, without holding up a new one. */
  readonly flush = (): Promise<void> => {
    this.flushing ??= this.sendWaiting()
      .catch(() => undefined)
      .finally(() => {
        this.flushing = null;
        this.retrySoon();
      });
    return this.flushing;
  };

  private async sendWaiting(): Promise<void> {
    const { storage, connection, send } = this.options;
    let next = RETRY_MS;
    this.held = null;
    for (const id of await storage.waitingIds()) {
      if (this.disposed || !connection.online()) break;
      const kept = await storage.readWaiting(id);
      const outcome = kept
        ? await send(kept.submission, kept.pictures)
        : 'failed';
      // Past today's limit nothing more gets through until the next day.
      if (outcome === 'limit') next = this.untilLimitStartsAgain();
      if (outcome === 'limit' || outcome === 'later') this.held = outcome;
      if (outcome === 'limit') break;
      // One the team cannot take yet holds back those sent after it.
      if (outcome === 'later') next = Math.min(this.retryMs * 2, MAX_RETRY_MS);
      if (outcome === 'later') break;
      await storage.dropWaiting(id);
    }
    this.retryMs = next;
    this.set({ waiting: (await storage.waitingIds()).length });
  }

  /** Settles once every change asked for so far has been made. */
  async settled(): Promise<void> {
    await this.queue;
    await this.sending;
    await this.flushing;
    await this.queue;
  }

  dispose(): void {
    this.disposed = true;
    this.options.timers.clearTimeout(this.retry);
    this.listeners.clear();
  }
}

function mergeEvents(
  kept: readonly DebugEvent[],
  fresh: readonly DebugEvent[]
): readonly DebugEvent[] {
  // What is still in the buffer replaces its older copy; only what came before is added.
  const first = fresh[0]?.at;
  const before = first ? kept.filter((event) => event.at < first) : kept;
  return [...before, ...fresh].slice(-MAX_KEPT_EVENTS);
}
