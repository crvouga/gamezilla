import type { Clock, Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { FeedbackWorkspacePort, WizardStage } from '../shared/workspace';
import { FEEDBACK_TEMPLATES } from '../shared/templates';
import { DraftEvidence } from './draft-evidence';
import { FeedbackWorkspace } from './workspace';
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
  FeedbackRepository,
} from '../shared/types';
import { EMPTY_FEEDBACK, feedbackErrors } from '../shared/validation';
import { feedbackContextProviders } from './context';
import { createReproductionRecorder } from './recording';
import type { RecordingPort } from './recording-types';

export type FeedbackControllerOptions = {
  readonly reporter: FeedbackRepository;
  readonly workspace: FeedbackWorkspacePort;
  readonly authorId: string;
  readonly evidence: ObjectStore;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly providers: readonly DiagnosticProvider[];
  readonly video?: RecordingPort;
  readonly layout?: { width: number; height: number };
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
  readonly workspace: FeedbackWorkspace;
  private readonly draftEvidence: DraftEvidence;
  readonly ready: Promise<void>;
  private restoring = false;
  private evidencePending: Promise<void> = Promise.resolve();
  private readonly evidenceReceipts = new WeakMap<
    EvidenceFile,
    FeedbackAttachment
  >();
  private readonly listeners = new Set<() => void>();
  readonly recorder: ReturnType<typeof createReproductionRecorder>;
  private readonly recordingSubscription: () => void;
  constructor(private readonly options: FeedbackControllerOptions) {
    this.workspace = new FeedbackWorkspace(options.workspace, options.createId);
    this.draftEvidence = new DraftEvidence(options.evidence, options.createId);
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
    this.ready = this.restoreActive();
  }
  private async restoreActive(): Promise<void> {
    const active = this.workspace.active();
    this.restoring = true;
    this.recorder.discard();
    this.publish({ draft: active ?? EMPTY_FEEDBACK, files: [], phase: 'idle', issue: active?.issue ?? null, attempted: null });
    if (active) {
      try {
        const files = await Promise.all(active.files.map(file => this.draftEvidence.read(file)));
        const video = active.video ? await this.draftEvidence.read(active.video) : null;
        this.publish({ files });
        this.recorder.restore(active.recording, video);
      } catch (error) { this.publish({ message: error instanceof Error ? error.message : 'Evidence could not be restored.' }); }
    }
    this.restoring = false;
    this.publish({});
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
  private persist(): void { this.workspace.update(this.current.draft); this.publish({}); }
  setStage = (stage: WizardStage): void => { this.workspace.stage(stage); this.publish({}); };
  applyTemplate = (kind: FeedbackKind): void => {
    const template = FEEDBACK_TEMPLATES.find(t => t.kind === kind);
    if (template) this.setDraft({ kind, description: [this.current.draft.description, template.body].filter(Boolean).join('\n\n') });
  };
  newDraft = async (): Promise<void> => {
    if (this.current.phase === 'sending') return;
    await this.evidencePending;
    this.workspace.create(); await this.restoreActive(); this.open();
  };
  select = async (id: string): Promise<void> => {
    if (this.current.phase === 'sending') return;
    await this.evidencePending;
    this.workspace.select(id); await this.restoreActive();
  };
  manage = async (): Promise<void> => {
    this.setStage('manage');
    try { this.workspace.merge(await this.options.reporter.list(this.options.authorId)); this.publish({}); }
    catch { this.publish({ message: 'Reports could not be refreshed. Your saved drafts are available.' }); }
  };
  remove = async (id: string): Promise<void> => {
    const doc = this.workspace.state().documents.find(d => d.id === id);
    if (!doc) return;
    if (doc.report) await this.options.reporter.remove(doc.report.id, this.options.authorId);
    this.workspace.remove(id); await this.restoreActive(); this.setStage('manage');
  };
  move = (x: number, y: number): void => { this.workspace.patch({ position: { x, y } }); this.publish({}); };
  removeRemoteAttachment = (id: string): void => {
    const report = this.workspace.active()?.report;
    if (report) this.workspace.update({ report: { ...report, attachments: report.attachments.filter(a => a.id !== id) } });
    this.publish({});
  };
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
  };

  reportAttachmentError = (message: string): void => {
    this.publish({ message });
  };
  preview = (file: EvidenceFile) => this.options.preview?.(file);
  attach = async (file: EvidenceFile): Promise<void> => {
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
    try {
      const saved = await this.draftEvidence.save(file);
      const active = this.workspace.active();
      this.workspace.update({ files: [...(active?.files ?? []), saved] });
    } catch { this.publish({ message: 'Attachment could not be saved. Keep the original file and try again.' }); return; }
    this.publish({
      files: [...this.current.files, file],
      attempted: null,
      message: null,
    });
  };
  removeFile = (index: number): void => {
    if (this.current.phase === 'sending') return;
    this.workspace.update({ files: (this.workspace.active()?.files ?? []).filter((_, i) => i !== index) });
    this.publish({
      files: this.current.files.filter((_, i) => i !== index),
      attempted: null,
    });
  };
  private recordingChanged(): void {
    if (this.restoring) return;
    const state = this.recorder.state();
    this.workspace.update({ recording: state.recording });
    if (state.phase === 'idle') this.workspace.update({ video: null });
    if (state.phase === 'starting' || state.phase === 'idle') this.publish({ attempted: null });
    if (state.phase === 'recording') this.publish({ visible: false });
    if (state.phase === 'ready') {
      this.publish({ visible: true });
      if (state.video) {
        this.evidencePending = this.draftEvidence.save(state.video).then(video => {
          this.workspace.update({ video }); this.publish({});
        }).catch(() => this.publish({ message: 'Recording video could not be saved. Download it before closing.' }));
      }
    }
    this.publish({});
  }
  async send(): Promise<void> {
    await this.ready;
    await this.evidencePending;
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
        authorId: this.options.authorId,
        createId: () => this.workspace.active()?.report?.id ?? this.current.attempted?.id ?? this.options.createId(),
        reporter: {
          create: async (report) => {
            this.publish({ attempted: report });
            const attachments = await this.uploadEvidence();
            const previous = this.workspace.active()?.report;
            const complete = { ...report, attachments: [...(previous?.attachments ?? []), ...attachments], createdAt: previous?.createdAt ?? report.createdAt };
            this.publish({ attempted: complete });
            return previous ? this.options.reporter.update(complete) : this.options.reporter.create(complete);
          },
        },
      });
      const saved = await service.submit({
        ...this.current.draft,
        recording: this.recorder.state().recording,
        attachments: [],
      });
      this.publish({ phase: 'saved', issue: saved.issue });
      this.workspace.update({ report: this.current.attempted ?? saved.report, issue: saved.issue, files: [], video: null });
      this.publish({ files: [] });

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
