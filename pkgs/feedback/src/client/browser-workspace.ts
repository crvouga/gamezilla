import type { CreateId } from '@pkgs/uuid';
import type {
  FeedbackWorkspacePort,
  FeedbackWorkspaceSnapshot,
} from '../shared/workspace';

/** Platform journal adapter; the controller never reads browser storage. */
export function createBrowserWorkspace(
  storage: () => Storage,
  createId: CreateId
) {
  let authorId = createId();
  try {
    authorId = storage().getItem('feedback-author') ?? authorId;
    storage().setItem('feedback-author', authorId);
  } catch {
    /* The workspace surfaces storage failure without blocking the app. */
  }
  const workspace: FeedbackWorkspacePort = {
    load() {
      const saved = storage().getItem('feedback-workspace');
      if (saved) return JSON.parse(saved) as FeedbackWorkspaceSnapshot;
      const legacy = storage().getItem('root-feedback-draft');
      return legacy
        ? importLegacyDraft(
            JSON.parse(legacy) as Parameters<typeof importLegacyDraft>[0],
            createId
          )
        : null;
    },
    save(snapshot) {
      storage().setItem('feedback-workspace', JSON.stringify(snapshot));
      storage().removeItem('root-feedback-draft');
    },
  };
  return { authorId, workspace };
}
function importLegacyDraft(
  value: {
    description?: string;
    expected?: string;
    reproductionSteps?: string;
    kind?: string;
  },
  createId: CreateId
): FeedbackWorkspaceSnapshot {
  if (typeof value.description !== 'string')
    throw new Error('Unreadable saved feedback');
  const id = createId();
  const description = [
    value.description,
    value.expected ? `## Expected outcome\n\n${value.expected}` : '',
    value.reproductionSteps
      ? `## Reproduction steps\n\n${value.reproductionSteps}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const kind =
    value.kind === 'feature' || value.kind === 'gap' || value.kind === 'polish'
      ? value.kind
      : 'problem';
  return {
    version: 1,
    activeId: id,
    stage: 'write',
    management: { search: '', filter: 'all' },
    position: { x: 0, y: 0 },
    documents: [
      {
        id,
        kind,
        title: '',
        description,
        report: null,
        attempted: null,
        issue: null,
        recording: null,
        files: [],
        video: null,
      },
    ],
  };
}
