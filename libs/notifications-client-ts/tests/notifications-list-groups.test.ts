import { expect, test } from 'bun:test';
import {
  type ListRow,
  notificationRows,
} from '@libs/notifications-client-ts/notifications-list';
import type {
  Notification,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import { NEEDS_YOU_SECTION_KEY } from '@libs/notifications-shared-ts/notifications-sections';

function item(id: string): Notification {
  return { id } as Notification;
}

function section(key: string, ids: readonly string[]): NotificationSection {
  return { key, title: key, items: ids.map(item) };
}

/** Each row as a short tag: a group, a day (nested or not), or an item. */
function shape(rows: readonly ListRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === 'group') return `group:${String(row.title)}:${row.count}`;
    if (row.kind === 'header')
      return `${row.nested ? 'day>' : 'day:'}${String(row.title)}`;
    return row.kind === 'item' ? `item:${row.key}` : 'loading';
  });
}

test('with something that needs the person, the inbox is Needs you above the Activity timeline', () => {
  const rows = notificationRows(
    [
      section(NEEDS_YOU_SECTION_KEY, ['invite', 'move']),
      section('today', ['started']),
      section('yesterday', []),
      section('earlier', ['puzzles']),
    ],
    'Activity'
  );
  expect(shape(rows)).toEqual([
    `group:${NEEDS_YOU_SECTION_KEY}:2`,
    'item:invite',
    'item:move',
    'group:Activity:null',
    'day>today',
    'item:started',
    'day>earlier',
    'item:puzzles',
  ]);
  // The first day sits right under the Activity heading.
  const firstDay = rows.find((row) => row.kind === 'header');
  expect(firstDay?.kind === 'header' && firstDay.leading).toBe(true);
});

test('with nothing that needs the person, the inbox is the timeline by day alone', () => {
  const rows = notificationRows(
    [section(NEEDS_YOU_SECTION_KEY, []), section('today', ['started'])],
    'Activity'
  );
  expect(shape(rows)).toEqual(['day:today', 'item:started']);
});

test('the Needs you filter shows only its group', () => {
  const rows = notificationRows(
    [section(NEEDS_YOU_SECTION_KEY, ['invite'])],
    'Activity'
  );
  expect(shape(rows)).toEqual([
    `group:${NEEDS_YOU_SECTION_KEY}:1`,
    'item:invite',
  ]);
});
