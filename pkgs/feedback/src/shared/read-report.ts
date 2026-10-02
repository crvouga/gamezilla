import { createFeedbackBody } from './report-body';
import type {
  Diagnostic,
  FeedbackAttachment,
  FeedbackKind,
  FeedbackReport,
  ReproductionRecording,
} from './types';

function kind(value: unknown): FeedbackKind {
  if (
    value === 'problem' ||
    value === 'feature' ||
    value === 'gap' ||
    value === 'polish'
  )
    return value;
  throw new Error('Unreadable feedback kind');
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Unreadable feedback ${name}`);
  return value;
}

function legacySource(input: Record<string, unknown>): string {
  const observed = `## What happened\n\n${text(input['description'], 'body')}`;
  const expected =
    typeof input['expected'] === 'string' && input['expected'].trim()
      ? `## What was expected\n\n${input['expected']}`
      : '';
  const steps =
    typeof input['reproductionSteps'] === 'string' &&
    input['reproductionSteps'].trim()
      ? `## Reproduction steps\n\n${input['reproductionSteps']}`
      : '';
  return [observed, expected, steps].filter(Boolean).join('\n\n');
}

export function readFeedbackReport(value: unknown): FeedbackReport {
  if (typeof value !== 'object' || value === null)
    throw new Error('Unreadable feedback report');
  const input = value as Record<string, unknown>;
  const body = input['body'];
  const legacy = input['version'] === 1;
  const source =
    typeof body === 'object' &&
    body !== null &&
    (body as Record<string, unknown>)['format'] === 'markdown'
      ? text((body as Record<string, unknown>)['source'], 'body')
      : legacySource(input);
  const report: FeedbackReport = {
    schema: 'feedback.report/v2',
    id: text(input['id'], 'id'),
    title: text(input['title'], 'title'),
    kind: kind(input['kind']),
    body: createFeedbackBody(source),
    createdAt: text(input['createdAt'], 'date'),
    status: input['status'] === 'deleted' ? 'deleted' : 'open',
    authorId:
      typeof input['authorId'] === 'string'
        ? input['authorId']
        : legacy
          ? 'local'
          : text(input['authorId'], 'author'),
    diagnostics: Array.isArray(input['diagnostics'])
      ? (input['diagnostics'] as readonly Diagnostic[])
      : [],
    recording:
      typeof input['recording'] === 'object' && input['recording'] !== null
        ? (input['recording'] as ReproductionRecording)
        : null,
    attachments: Array.isArray(input['attachments'])
      ? (input['attachments'] as readonly FeedbackAttachment[])
      : [],
  };
  return report;
}
