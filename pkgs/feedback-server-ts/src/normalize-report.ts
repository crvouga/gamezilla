import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  createFeedbackBody,
  resolveFeedbackTitle,
} from '@pkgs/feedback-shared-ts/report-body';
import type {
  Diagnostic,
  FeedbackAttachment,
  FeedbackKind,
  FeedbackReport,
  ReproductionRecording,
} from '@pkgs/feedback-shared-ts/types';
import { validateFeedback } from '@pkgs/feedback-shared-ts/validation';

function diagnostics(value: unknown): readonly Diagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap<Diagnostic>((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const d = entry as Record<string, unknown>;
    if (typeof d['name'] !== 'string') return [];
    const name = d['name'].slice(0, 80);
    return d['status'] === 'available'
      ? [{ name, status: 'available', value: d['value'] ?? null }]
      : [{ name, status: 'unavailable', reason: 'Unavailable' }];
  });
}
function recording(value: unknown): ReproductionRecording | null {
  if (value === null || value === undefined) return null;
  const input = value as Partial<ReproductionRecording>;
  if (
    input.version !== 1 ||
    typeof input.startedAt !== 'string' ||
    typeof input.durationMs !== 'number' ||
    !Number.isFinite(input.durationMs) ||
    input.durationMs < 0 ||
    input.durationMs > 95_000 ||
    !Array.isArray(input.actions) ||
    input.actions.length > 200
  )
    throw new Error('Invalid recording');
  for (const action of input.actions) {
    if (
      ![
        'click',
        'input',
        'navigation',
        'pointerdown',
        'pointerup',
        'keydown',
      ].includes(action.type) ||
      !Number.isFinite(action.atMs) ||
      action.atMs < 0 ||
      typeof action.path !== 'string' ||
      typeof action.target !== 'string' ||
      typeof action.label !== 'string' ||
      (action.value !== null && typeof action.value !== 'string') ||
      (action.point !== null &&
        (!Number.isFinite(action.point.x) || !Number.isFinite(action.point.y)))
    )
      throw new Error('Invalid action');
  }
  return {
    version: 1,
    startedAt: input.startedAt,
    durationMs: input.durationMs,
    actions: input.actions,
    truncated: input.truncated === true,
    initialContext: diagnostics(input.initialContext),
    finalContext: diagnostics(input.finalContext),
  };
}
export function normalizeReport(body: unknown, clock: Clock): FeedbackReport {
  if (typeof body !== 'object' || body === null)
    throw new Error('Invalid report');
  const input = body as Record<string, unknown>;
  const reportBody = input['body'];
  if (
    typeof input['id'] !== 'string' ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(input['id'])
  )
    throw new Error('Invalid report id');
  if (
    input['schema'] !== 'feedback.report/v2' ||
    typeof input['kind'] !== 'string' ||
    !['problem', 'feature', 'gap', 'polish'].includes(input['kind']) ||
    typeof reportBody !== 'object' ||
    reportBody === null ||
    (reportBody as Record<string, unknown>)['format'] !== 'markdown' ||
    typeof (reportBody as Record<string, unknown>)['source'] !== 'string' ||
    typeof input['title'] !== 'string' ||
    typeof input['authorId'] !== 'string' ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(input['authorId'])
  )
    throw new Error('Invalid report text');
  const draft = {
    kind: input['kind'] as FeedbackKind,
    body: (reportBody as Record<string, unknown>)['source'] as string,
    title: input['title'],
  };
  validateFeedback(draft);
  let createdAt = 'unknown';
  try {
    createdAt = new Date(clock.now()).toISOString();
  } catch {
    /* Emergency report. */
  }
  if (
    input['attachments'] !== undefined &&
    (!Array.isArray(input['attachments']) || input['attachments'].length > 4)
  )
    throw new Error('Too many attachments');
  return {
    schema: 'feedback.report/v2',
    id: input['id'],
    title: resolveFeedbackTitle(draft),
    kind: draft.kind,
    body: createFeedbackBody(draft.body),
    authorId: input['authorId'],
    createdAt,
    status: 'open',
    diagnostics: diagnostics(input['diagnostics']),
    recording: recording(input['recording']),
    attachments: Array.isArray(input['attachments'])
      ? (input['attachments'] as readonly FeedbackAttachment[])
      : [],
  };
}
