import type { Clock } from '@pkgs/clock';
import type {
  Diagnostic,
  FeedbackReport,
  ReproductionRecording,
} from '../shared/types';
import { validateFeedback } from '../shared/validation';

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
  const input = body as Partial<FeedbackReport>;
  if (typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(input.id))
    throw new Error('Invalid report id');
  if (
    typeof input.kind !== 'string' ||
    typeof input.description !== 'string' ||
    typeof input.expected !== 'string' ||
    typeof input.reproductionSteps !== 'string'
  )
    throw new Error('Invalid report text');
  const draft = {
    kind: input.kind,
    description: input.description,
    expected: input.expected,
    reproductionSteps: input.reproductionSteps,
  };
  validateFeedback(draft);
  let createdAt = 'unknown';
  try {
    createdAt = new Date(clock.now()).toISOString();
  } catch {
    /* Emergency report. */
  }
  if (
    input.attachments !== undefined &&
    (!Array.isArray(input.attachments) || input.attachments.length > 4)
  )
    throw new Error('Too many attachments');
  return {
    version: 1,
    id: input.id,
    title:
      input.description.trim().split('\n').at(0)?.slice(0, 240) ?? 'Feedback',
    kind: draft.kind,
    description: input.description.trim(),
    expected: input.expected.trim(),
    reproductionSteps: input.reproductionSteps.trim(),
    createdAt,
    status: 'open',
    diagnostics: diagnostics(input.diagnostics),
    recording: recording(input.recording),
    attachments: input.attachments ?? [],
  };
}
