import type { CreateId } from '@pkgs/uuid';
import { EMPTY_FEEDBACK } from '../shared/validation';
import type {
  FeedbackDocument,
  FeedbackWorkspacePort,
  FeedbackWorkspaceSnapshot,
  WizardStage,
} from '../shared/workspace';

export class FeedbackWorkspace {
  private value: FeedbackWorkspaceSnapshot;
  warning: string | null = null;
  private damaged = false;
  constructor(
    private readonly port: FeedbackWorkspacePort,
    private readonly createId: CreateId
  ) {
    this.value = {
      version: 1,
      activeId: '',
      documents: [],
      stage: 'write',
      management: { search: '' },
      position: { x: 0, y: 0 },
    };
    try {
      const saved = port.load();
      if (saved) {
        if (!Array.isArray(saved.documents))
          throw new Error('Unreadable drafts');
        this.value = saved;
      }
    } catch {
      this.damaged = true;
      this.warning =
        'Stored drafts could not be read. Your saved data has been kept; export this writing before closing.';
    }
    if (!this.active()) this.create();
  }
  state = () => this.value;
  active = () => this.value.documents.find((d) => d.id === this.value.activeId);
  private save(): void {
    if (this.damaged) return;
    try {
      this.port.save(this.value);
      this.warning = null;
    } catch {
      this.warning =
        'Draft could not be saved on this device. Keep a copy before closing, then try saving again.';
    }
  }
  patch(next: Partial<FeedbackWorkspaceSnapshot>): void {
    this.value = { ...this.value, ...next };
    this.save();
  }
  updateDocument(id: string, next: Partial<FeedbackDocument>): void {
    this.patch({
      documents: this.value.documents.map((doc) =>
        doc.id === id ? { ...doc, ...next } : doc
      ),
    });
  }
  update(next: Partial<FeedbackDocument>): void {
    this.patch({
      documents: this.value.documents.map((d) =>
        d.id === this.value.activeId ? { ...d, ...next } : d
      ),
    });
  }
  create(): void {
    const id = this.createId();
    const doc: FeedbackDocument = {
      ...EMPTY_FEEDBACK,
      id,
      report: null,
      attempted: null,
      issue: null,
      recording: null,
      files: [],
      video: null,
    };
    this.patch({
      documents: [...this.value.documents, doc],
      activeId: id,
      stage: 'write',
      management: { search: '' },
    });
  }
  select(id: string): void {
    if (this.value.documents.some((d) => d.id === id))
      this.patch({ activeId: id, stage: 'read' });
  }
  remove(id: string): void {
    this.patch({
      documents: this.value.documents.filter((d) => d.id !== id),
      stage: 'manage',
    });
    if (!this.active())
      this.patch({ activeId: this.value.documents[0]?.id ?? '' });
  }
  stage(stage: WizardStage): void {
    this.patch({ stage });
  }
  merge(reports: readonly import('../shared/types').FeedbackReport[]): void {
    const documents = [...this.value.documents];
    for (const report of reports) {
      if (!documents.some((d) => d.report?.id === report.id))
        documents.push({
          id: report.id,
          kind: report.kind,
          title: report.title,
          body: report.body.source,
          report,
          attempted: null,
          issue: { id: report.id },
          recording: report.recording,
          files: [],
          video: null,
        });
    }
    this.patch({ documents });
  }
  retrySave(): void {
    this.save();
  }
}
