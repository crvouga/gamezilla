import type { Clock, Timers } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid';
import { collectDiagnostics } from '../shared/diagnostics';
import { createFeedbackReporting } from '../shared/reporting';
import type {
  CreatedIssue,
  DiagnosticProvider,
  EvidenceFile,
  FeedbackAttachment,
  FeedbackDraft,
  FeedbackKind,
  FeedbackReport,
  IssueReporter,
} from '../shared/types';
import { EMPTY_FEEDBACK, feedbackErrors } from '../shared/validation';
import { feedbackContextProviders } from './context';
import { createReproductionRecorder } from './recording';
import type { RecordingPort } from './recording-types';

export type FeedbackDraftStore = {
  save(value: string): void;
  load(): string | null;
  clear(): void;
};

export type FeedbackControllerOptions = {
  readonly reporter: IssueReporter;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly providers: readonly DiagnosticProvider[];
  readonly draft?: FeedbackDraftStore;
  readonly video?: RecordingPort;
  readonly theme?: {
    read: () => 'light' | 'dark';
    subscribe: (listener: () => void) => () => void;
  };
  readonly preview?: (file: EvidenceFile) => {
    url: string;
    dispose: () => void;
  };
  readonly upload?: (file: EvidenceFile) => Promise<FeedbackAttachment>;
};

export type FeedbackState = {
  readonly visible: boolean;
  readonly draft: FeedbackDraft;
  readonly errors: Partial<Record<keyof FeedbackDraft, string>>;
  readonly phase: 'idle' | 'sending' | 'saved' | 'failed';
  readonly issue: CreatedIssue | null;
  readonly attempted: FeedbackReport | null;
  readonly files: readonly EvidenceFile[];
  readonly message: string | null;
};

export class FeedbackController {
  private current: FeedbackState = {
    visible: false,
    draft: EMPTY_FEEDBACK,
    errors: {},
    phase: 'idle',
    issue: null,
    attempted: null,
    files: [],
    message: null,
  };
  private readonly evidenceReceipts = new WeakMap<
    EvidenceFile,
    FeedbackAttachment
  >();
  private readonly listeners = new Set<() => void>();
  readonly recorder: ReturnType<typeof createReproductionRecorder>;
  private readonly recordingSubscription: () => void;
  constructor(private readonly options: FeedbackControllerOptions) {
    this.recorder = createReproductionRecorder({
      clock: options.clock,
      timers: options.timers,
      video: options.video ?? null,
      captureContext: () =>
        collectDiagnostics(this.providers(), options.timers, 500, 16_000),
    });
    this.recordingSubscription = this.recorder.subscribe(() =>
      this.recordingChanged()
    );
    try {
      const saved = options.draft?.load();
      if (saved) {
        const data = JSON.parse(saved) as Partial<FeedbackDraft>;
        if (typeof data.description === 'string')
          this.current = {
            ...this.current,
            draft: {
              kind:
                data.kind &&
                ['problem', 'feature', 'gap', 'polish'].includes(data.kind)
                  ? data.kind
                  : 'problem',
              description: data.description,
              expected: typeof data.expected === 'string' ? data.expected : '',
              reproductionSteps:
                typeof data.reproductionSteps === 'string'
                  ? data.reproductionSteps
                  : '',
            },
          };
      }
    } catch {
      /* Optional storage never blocks feedback. */
    }
  }
  private providers(): readonly DiagnosticProvider[] {
    return [...this.options.providers, ...feedbackContextProviders()];
  }
  state = (): FeedbackState => this.current;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: Partial<FeedbackState>): void {
    this.current = { ...this.current, ...next };
    for (const listener of this.listeners) listener();
  }
  private persist(): void {
    try {
      this.options.draft?.save(JSON.stringify(this.current.draft));
    } catch {
      /* Storage may be unavailable. */
    }
  }
  setDraft = (next: Partial<FeedbackDraft>): void => {
    if (this.current.phase === 'sending') return;
    this.publish({
      draft: { ...this.current.draft, ...next },
      errors: {},
      phase: 'idle',
      attempted: null,
      message: null,
    });
    this.persist();
  };
  open = (kind?: FeedbackKind): void => {
    if (kind) this.setDraft({ kind });
    this.publish({ visible: true });
  };
  close = (): void => {
    if (this.current.phase === 'sending') return;
    this.publish({ visible: false });
    if (this.current.phase === 'saved') {
      this.recorder.discard();
      this.publish({
        draft: EMPTY_FEEDBACK,
        phase: 'idle',
        issue: null,
        attempted: null,
        files: [],
        message: null,
      });
    }
  };
  reportAttachmentError = (message: string): void => {
    this.publish({ message });
  };
  preview = (file: EvidenceFile) => this.options.preview?.(file);
  attach = (file: EvidenceFile): void => {
    if (this.current.phase === 'sending') return;
    if (!file.bytes.byteLength) {
      this.publish({ message: 'Choose a non-empty video or image.' });
      return;
    }
    if (file.bytes.byteLength > 12 * 1024 * 1024) {
      this.publish({
        message: 'Keep attachments under 12 MB. Choose a shorter recording.',
      });
      return;
    }
    if (this.current.files.length >= 3) {
      this.publish({ message: 'You can attach up to three files.' });
      return;
    }
    if (
      !/^video\/(webm|mp4|quicktime)$|^image\/(png|jpeg|webp)$/.test(
        file.contentType
      )
    ) {
      this.publish({ message: 'Choose a video or an image.' });
      return;
    }
    this.publish({ files: [...this.current.files, file], message: null });
  };
  removeFile = (index: number): void => {
    if (this.current.phase === 'sending') return;
    this.publish({ files: this.current.files.filter((_, i) => i !== index) });
  };
  private recordingChanged(): void {
    const state = this.recorder.state();
    if (state.phase === 'recording') this.publish({ visible: false });
    if (state.phase === 'ready') {
      const steps =
        state.recording?.actions
          .map(
            (action, index) =>
              `${index + 1}. ${action.type === 'input' ? 'Enter' : 'Use'} ${action.label || action.target}${action.value === null ? '' : `: ${action.value}`} (${action.path})`
          )
          .join('\n')
          .slice(0, 32_000) ?? '';
      if (!this.current.draft.reproductionSteps.trim() && steps)
        this.setDraft({ reproductionSteps: steps });
      this.publish({ visible: true });
    }
    this.publish({});
  }
  async send(): Promise<void> {
    if (this.current.phase === 'sending') return;
    const errors = feedbackErrors(this.current.draft);
    if (Object.keys(errors).length) {
      this.publish({ errors });
      return;
    }
    if (
      ['starting', 'recording', 'stopping'].includes(
        this.recorder.state().phase
      )
    )
      return;
    this.publish({ phase: 'sending', errors: {}, message: null });
    try {
      const service = createFeedbackReporting({
        ...this.options,
        providers: this.providers(),
        createId: () => this.current.attempted?.id ?? this.options.createId(),
        reporter: {
          create: async (report) => {
            this.publish({ attempted: report });
            const attachments = await this.uploadEvidence();
            const complete = { ...report, attachments };
            this.publish({ attempted: complete });
            return this.options.reporter.create(complete);
          },
        },
      });
      const saved = await service.submit({
        ...this.current.draft,
        recording: this.recorder.state().recording,
        attachments: [],
      });
      this.publish({ phase: 'saved', issue: saved.issue });
      try {
        this.options.draft?.clear();
      } catch {
        /* Optional storage. */
      }
    } catch (error) {
      this.publish({
        phase: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Feedback could not be sent.',
      });
    }
  }
  private async uploadEvidence(): Promise<readonly FeedbackAttachment[]> {
    const video = this.recorder.state().video;
    const files = [...this.current.files, ...(video ? [video] : [])];
    if (!files.length) return [];
    const upload = this.options.upload;
    if (!upload)
      throw new Error(
        'Attachments are unavailable. Keep your recording, or remove it to send the feedback.'
      );
    return Promise.all(
      files.map(async (file) => {
        const cached = this.evidenceReceipts.get(file);
        if (cached) return cached;
        const receipt = await upload(file);
        this.evidenceReceipts.set(file, receipt);
        return receipt;
      })
    );
  }
  emergencyCopy(): string {
    return JSON.stringify(
      this.current.attempted ?? {
        ...this.current.draft,
        recording: this.recorder.state().recording,
        diagnostics: [],
      },
      null,
      2
    );
  }
  dispose(): void {
    this.recordingSubscription();
    this.recorder.dispose();
    this.listeners.clear();
  }
}
