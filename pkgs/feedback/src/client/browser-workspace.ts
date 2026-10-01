import type { CreateId } from '@pkgs/uuid';
import { readFeedbackReport } from '../shared/read-report';
import type {
  FeedbackDocument,
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
      if (saved) return readWorkspace(JSON.parse(saved));
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
  const body = [
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
    management: { search: '' },
    position: { x: 0, y: 0 },
    documents: [
      {
        id,
        kind,
        title: '',
        body,
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

function readWorkspace(value: unknown): FeedbackWorkspaceSnapshot {
  if (typeof value !== 'object' || value === null)
    throw new Error('Unreadable saved feedback');
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input['documents']))
    throw new Error('Unreadable saved feedback');
  const documents = input['documents'].map(readDocument);
  const savedManagement = input['management'];
  const management =
    typeof savedManagement === 'object' &&
    savedManagement !== null &&
    typeof (savedManagement as Record<string, unknown>)['search'] === 'string'
      ? {
          search: (savedManagement as Record<string, unknown>)[
            'search'
          ] as string,
        }
      : { search: '' };
  const position = input['position'] as
    | FeedbackWorkspaceSnapshot['position']
    | undefined;
  const stage =
    input['stage'] === 'manage' ||
    input['stage'] === 'read' ||
    input['stage'] === 'context'
      ? input['stage']
      : 'write';
  return {
    version: 1,
    activeId: typeof input['activeId'] === 'string' ? input['activeId'] : '',
    documents,
    management,
    position: position ?? { x: 0, y: 0 },
    stage,
  };
}

function readDocument(value: unknown): FeedbackDocument {
  if (typeof value !== 'object' || value === null)
    throw new Error('Unreadable saved draft');
  const input = value as Record<string, unknown>;
  const source =
    typeof input['body'] === 'string'
      ? input['body']
      : typeof input['description'] === 'string'
        ? input['description']
        : '';
  return {
    id: typeof input['id'] === 'string' ? input['id'] : '',
    kind:
      input['kind'] === 'feature' ||
      input['kind'] === 'gap' ||
      input['kind'] === 'polish'
        ? input['kind']
        : 'problem',
    title: typeof input['title'] === 'string' ? input['title'] : '',
    body: source,
    report: input['report'] ? readFeedbackReport(input['report']) : null,
    attempted: input['attempted']
      ? readFeedbackReport(input['attempted'])
      : null,
    issue: (input['issue'] as FeedbackDocument['issue']) ?? null,
    recording: (input['recording'] as FeedbackDocument['recording']) ?? null,
    files: Array.isArray(input['files'])
      ? (input['files'] as FeedbackDocument['files'])
      : [],
    video: (input['video'] as FeedbackDocument['video']) ?? null,
  };
}
