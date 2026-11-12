import type {
  BugReportSubmission,
  DebugEvent,
  ScreenshotFile,
} from '@pkgs/feedback-shared-ts/types';
import {
  readBytes,
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';

export type DraftScreenshot = {
  readonly id: string;
  readonly contentType: string;
  /** Taken by the app when the bug report opened, not added by the person. */
  readonly auto: boolean;
};

export type Draft = {
  /** Fixed before sending, so a report sent twice is still one report. */
  readonly reportId: string;
  description: string;
  screenshots: DraftScreenshot[];
  /** The debug info kept before the bug report was opened. */
  events: readonly DebugEvent[];
};

export type KeptBugReport = {
  readonly submission: BugReportSubmission;
  readonly pictures: readonly ScreenshotFile[];
};

export type ShakePreference = 'on' | 'off';

const JSON_TYPE = 'application/json';
/** Wide enough that the order kept bug reports were sent in is the order of their names. */
const TURN_DIGITS = 12;

/**
 * Everything bug reporting keeps on the device: the draft, bug reports
 * waiting to be sent, and the debug info of the last visit. Reading never
 * fails: a device that lost or cannot keep any of it starts afresh.
 */
export class BugReportStorage {
  constructor(
    private readonly store: ObjectStore,
    private readonly createId: () => string
  ) {}

  private async readJson<T>(key: string): Promise<T | null> {
    try {
      const text = await readUtf8(this.store, key);
      return text === null ? null : (JSON.parse(text) as T);
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): Promise<void> {
    return writeUtf8(this.store, key, JSON.stringify(value), JSON_TYPE);
  }

  async reporterId(): Promise<string> {
    const known = await this.readJson<string>('reporter-id.json');
    if (typeof known === 'string') return known;
    const id = this.createId();
    await this.writeJson('reporter-id.json', id).catch(() => undefined);
    return id;
  }

  async loadDraft(): Promise<Draft> {
    const draft = await this.readJson<Draft>('draft.json');
    return draft && typeof draft.reportId === 'string'
      ? draft
      : {
          reportId: this.createId(),
          description: '',
          screenshots: [],
          events: [],
        };
  }

  saveDraft(draft: Draft): Promise<void> {
    return this.writeJson('draft.json', draft).catch(() => undefined);
  }

  /** Forgets the draft and its pictures; the next bug report starts empty. */
  async clearDraft(draft: Draft): Promise<Draft> {
    await this.store
      .deleteMany([
        'draft.json',
        ...draft.screenshots.map((screenshot) => `pictures/${screenshot.id}`),
      ])
      .catch(() => undefined);
    return this.loadDraft();
  }

  putPicture(id: string, file: ScreenshotFile): Promise<void> {
    return this.store.put(`pictures/${id}`, file.bytes, file.contentType);
  }

  deletePicture(id: string): Promise<void> {
    return this.store.delete(`pictures/${id}`).catch(() => undefined);
  }

  pictureUrl(id: string): Promise<string | null> {
    return this.store.getUri(`pictures/${id}`).catch(() => null);
  }

  async readPicture(
    screenshot: DraftScreenshot
  ): Promise<ScreenshotFile | null> {
    const bytes = await readObjectBytes(
      this.store,
      `pictures/${screenshot.id}`
    ).catch(() => null);
    return bytes ? { contentType: screenshot.contentType, bytes } : null;
  }

  /** Keeps a bug report that could not be sent, to send it later, after those kept before it. */
  async keep(kept: KeptBugReport): Promise<void> {
    const last = (await this.waitingIds()).at(-1);
    const turn = last === undefined ? 1 : Number.parseInt(last, 10) + 1;
    const folder = `waiting/${String(turn).padStart(TURN_DIGITS, '0')}-${kept.submission.id}`;
    for (const [index, picture] of kept.pictures.entries())
      await this.store.put(
        `${folder}/pictures/${index}`,
        picture.bytes,
        picture.contentType
      );
    // Written last: a bug report is waiting only once all of it is kept.
    await this.writeJson(`${folder}/report.json`, kept.submission);
  }

  /** The bug reports kept to send, in the order they were sent. */
  async waitingIds(): Promise<readonly string[]> {
    const keys = await this.store.listKeys('waiting/').catch(() => []);
    return keys
      .filter((key) => key.endsWith('/report.json'))
      .map((key) => key.split('/')[1] ?? '')
      .sort();
  }

  async readWaiting(id: string): Promise<KeptBugReport | null> {
    const folder = `waiting/${id}`;
    const submission = await this.readJson<BugReportSubmission>(
      `${folder}/report.json`
    );
    if (!submission) return null;
    const pictures: ScreenshotFile[] = [];
    for (const key of await this.store.listKeys(`${folder}/pictures/`)) {
      const object = await this.store.get(key);
      if (object)
        pictures.push({
          contentType: object.contentType,
          bytes: await readBytes(object.body),
        });
    }
    return { submission, pictures };
  }

  async dropWaiting(id: string): Promise<void> {
    const keys = await this.store.listKeys(`waiting/${id}/`);
    await this.store.deleteMany(keys);
  }

  async shakePreference(): Promise<ShakePreference | null> {
    const value = await this.readJson<string>('shake.json');
    return value === 'on' || value === 'off' ? value : null;
  }

  setShakePreference(value: ShakePreference): Promise<void> {
    return this.writeJson('shake.json', value).catch(() => undefined);
  }

  async loadTrail(): Promise<readonly DebugEvent[]> {
    const events = await this.readJson<readonly DebugEvent[]>('trail.json');
    return Array.isArray(events) ? events : [];
  }

  saveTrail(events: readonly DebugEvent[]): Promise<void> {
    return this.writeJson('trail.json', events).catch(() => undefined);
  }
}
