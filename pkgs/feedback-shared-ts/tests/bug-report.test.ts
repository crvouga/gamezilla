import { expect, test } from 'bun:test';
import {
  bugReportTitle,
  isDescribed,
  MAX_DESCRIPTION_LENGTH,
  pictureType,
  readBugReportSubmission,
} from '@pkgs/feedback-shared-ts/bug-report';

const VALID = {
  schema: 'bug-report/v1',
  id: '11111111-1111-4111-8111-111111111111',
  reporterId: '22222222-2222-4222-8222-222222222222',
  description: '  The board froze after a move  ',
  createdAt: '2026-03-02T10:00:00.000Z',
  debugInfo: {
    events: [
      {
        at: '2026-03-02T09:59:00.000Z',
        kind: 'choice',
        text: 'Chose "Play"',
        extra: 'dropped',
      },
    ],
    details: [
      { name: 'app', status: 'available', value: { version: '1.4.0' } },
      { name: 'connection', status: 'unavailable', reason: 'Timed out' },
    ],
  },
  smuggled: 'dropped',
} as const;

test('a bug report is read into exactly its own fields', () => {
  expect(readBugReportSubmission(VALID)).toEqual({
    schema: 'bug-report/v1',
    id: VALID.id,
    reporterId: VALID.reporterId,
    description: 'The board froze after a move',
    createdAt: VALID.createdAt,
    debugInfo: {
      events: [
        {
          at: '2026-03-02T09:59:00.000Z',
          kind: 'choice',
          text: 'Chose "Play"',
        },
      ],
      details: VALID.debugInfo.details,
    },
  });
});

test.each([
  ['no description', { description: '   ' }],
  ['a description too long', { description: 'x'.repeat(8001) }],
  ['an id that could name another file', { id: '../../etc/passwd' }],
  ['a reporter that is not an id', { reporterId: 'everyone' }],
  ['another schema', { schema: 'feedback/v1' }],
  ['a time that is not one', { createdAt: 'yesterday' }],
  ['no debug info', { debugInfo: null }],
  [
    'an event of an unknown kind',
    {
      debugInfo: {
        events: [{ at: VALID.createdAt, kind: 'typed', text: 'secret' }],
        details: [],
      },
    },
  ],
  [
    'more events than a buffer holds',
    {
      debugInfo: {
        events: Array.from({ length: 301 }, () => VALID.debugInfo.events[0]),
        details: [],
      },
    },
  ],
])('a bug report with %s is refused', (_name, change) => {
  expect(() => readBugReportSubmission({ ...VALID, ...change })).toThrow();
});

test('a description says something within its length', () => {
  expect(isDescribed(' \n ')).toBe(false);
  expect(isDescribed('x')).toBe(true);
  expect(isDescribed('x'.repeat(MAX_DESCRIPTION_LENGTH))).toBe(true);
  expect(isDescribed('x'.repeat(MAX_DESCRIPTION_LENGTH + 1))).toBe(false);
});

test('the title is the first line, cut to fit', () => {
  expect(bugReportTitle('\n The board froze \nafter my move')).toBe(
    'The board froze'
  );
  const long = bugReportTitle('y'.repeat(200));
  expect(long).toHaveLength(80);
  expect(long.endsWith('…')).toBe(true);
});

test('a picture is told from its bytes', () => {
  const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
  expect(
    pictureType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
  ).toBe('image/png');
  expect(pictureType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  expect(
    pictureType(
      new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')
    )
  ).toBe('image/webp');
  expect(
    pictureType(new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WAVE'))
  ).toBeNull();
  expect(pictureType(new TextEncoder().encode('<svg xmlns="x"/>'))).toBeNull();
  expect(pictureType(bytes())).toBeNull();
});

const SUBJECT = {
  testIds: ['example-settings', 'example-home'],
  component: 'Button',
  screen: 'home',
  name: 'Settings',
  role: 'button',
  box: { x: 10, y: 20, width: 120, height: 44 },
  viewport: { width: 1280, height: 800 },
  pointer: { x: 40, y: 30 },
  selectedText: null,
  extra: 'dropped',
} as const;

test('a bug report about one thing is read with exactly the subject fields', () => {
  const { extra: _extra, ...kept } = SUBJECT;
  expect(
    readBugReportSubmission({ ...VALID, subject: SUBJECT }).subject
  ).toEqual(kept);
});

test('a bug report about nothing in particular has no subject', () => {
  expect('subject' in readBugReportSubmission(VALID)).toBe(false);
});

test.each([
  ['a box off any screen', { box: { x: 1e9, y: 0, width: 1, height: 1 } }],
  [
    'a box that is not a number',
    { box: { x: '1', y: 0, width: 1, height: 1 } },
  ],
  ['too many test ids', { testIds: Array.from({ length: 13 }, () => 'a') }],
  ['a name too long', { name: 'x'.repeat(201) }],
  ['a selection too long', { selectedText: 'x'.repeat(1001) }],
  ['no viewport', { viewport: null }],
])('a subject with %s is refused', (_name, change) => {
  expect(() =>
    readBugReportSubmission({ ...VALID, subject: { ...SUBJECT, ...change } })
  ).toThrow();
});
