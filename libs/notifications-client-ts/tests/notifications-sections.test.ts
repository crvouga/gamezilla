import { describe, expect, test } from 'bun:test';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import {
  buildNotificationSections,
  NEEDS_YOU_SECTION_KEY,
  notificationNeedsYou,
} from '@libs/notifications-shared-ts/notifications-sections';

const NOW_MS = Date.parse('2023-11-14T22:00:00.000Z');
const now = (): number => NOW_MS;

function item(
  id: string,
  overrides: Partial<Notification> = {}
): Notification {
  return {
    id,
    sourceNamespace: 'spaces',
    sourceType: 'space_invite',
    sourceId: id,
    category: 'informational',
    title: id,
    createdAt: '2023-11-14T21:00:00.000Z',
    priority: 0,
    actions: [],
    payload: {},
    isUnread: false,
    isArchived: false,
    isDismissed: false,
    isActive: true,
    ...overrides,
  };
}

const JOIN = { id: 'accept', label: 'Join', variant: 'solid' } as const;
const FULL = {
  ...JOIN,
  disabled: true,
  disabledReason: 'Space is full',
} as const;

describe('notificationNeedsYou', () => {
  test('an invite the person can answer needs them', () => {
    expect(
      notificationNeedsYou(
        item('a', { category: 'action_required', actions: [JOIN] })
      )
    ).toBe(true);
  });

  test('a turn notice with nothing but opening needs them', () => {
    expect(
      notificationNeedsYou(item('a', { category: 'action_required' }))
    ).toBe(true);
  });

  test('an invite with every answer unavailable waits on nobody', () => {
    expect(
      notificationNeedsYou(
        item('a', { category: 'action_required', actions: [FULL] })
      )
    ).toBe(false);
  });

  test('updates, archived and inactive items wait on nobody', () => {
    expect(notificationNeedsYou(item('a'))).toBe(false);
    expect(
      notificationNeedsYou(
        item('a', {
          category: 'action_required',
          actions: [JOIN],
          isArchived: true,
        })
      )
    ).toBe(false);
    expect(
      notificationNeedsYou(
        item('a', {
          category: 'action_required',
          actions: [JOIN],
          isActive: false,
        })
      )
    ).toBe(false);
  });
});

describe('buildNotificationSections', () => {
  test('what needs the person leads, then updates by day', () => {
    const sections = buildNotificationSections(
      [
        item('update-today'),
        item('invite-yesterday', {
          category: 'action_required',
          actions: [JOIN],
          createdAt: '2023-11-13T20:00:00.000Z',
        }),
        item('full-yesterday', {
          category: 'action_required',
          actions: [FULL],
          createdAt: '2023-11-13T19:00:00.000Z',
        }),
        item('note-earlier', { createdAt: '2023-11-01T09:00:00.000Z' }),
      ],
      now
    );
    expect(
      sections.map((section) => [
        section.key,
        section.items.map((entry) => entry.id),
      ])
    ).toEqual([
      [NEEDS_YOU_SECTION_KEY, ['invite-yesterday']],
      ['today', ['update-today']],
      ['yesterday', ['full-yesterday']],
      ['earlier', ['note-earlier']],
    ]);
    expect(sections[0]?.title).toBe('Needs you');
  });

  test('with nothing pending there is no Needs you group', () => {
    const sections = buildNotificationSections([item('update')], now);
    expect(sections.map((section) => section.key)).toEqual(['today']);
  });
});
