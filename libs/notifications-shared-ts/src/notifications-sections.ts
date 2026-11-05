import type { Notification, NotificationSection } from './notification';

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sectionKeyForDate(iso: string, now: () => number): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'earlier';
  const today = startOfLocalDay(new Date(now()));
  const day = startOfLocalDay(date);
  const diffDays = Math.floor(
    (today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'this_week';
  return 'earlier';
}

/** The group of what waits on the person, ahead of the days. */
export const NEEDS_YOU_SECTION_KEY = 'needs_you';

const SECTION_TITLES: Record<string, string> = {
  [NEEDS_YOU_SECTION_KEY]: 'Needs you',
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  earlier: 'Earlier',
};

/**
 * Whether a notification waits on the person: an action-required item, in
 * the inbox and still active, that has an answer they can give now (or, like
 * a turn notice, asks them to open it). An invite whose every answer is
 * unavailable (the space is full) waits on nobody.
 */
export function notificationNeedsYou(item: Notification): boolean {
  if (item.category !== 'action_required') return false;
  if (!item.isActive || item.isArchived || item.isDismissed) return false;
  return (
    item.actions.length === 0 ||
    item.actions.some((action) => action.disabled !== true)
  );
}

/**
 * The priority of a notice whose time is running out (a turn about to be
 * lost on time). The inbox lists by priority, so it comes before anything
 * else that needs the person, and its card says how little time is left.
 */
export const TIME_CRITICAL_PRIORITY = 20;

/** A notice that needs the person and whose time is running out. */
export function notificationTimeCritical(item: Notification): boolean {
  return item.priority >= TIME_CRITICAL_PRIORITY && notificationNeedsYou(item);
}

/**
 * The order of what needs the person: the most urgent first (a notice whose
 * time is running out, then a turn or a request), and among equally urgent
 * ones the newest first, as the inbox query lists them
 * (`priority DESC, created_at DESC, id DESC`).
 */
export function compareNeedsYou(a: Notification, b: Notification): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * The inbox's groups: what needs the person first, by urgency and then
 * newest ({@link compareNeedsYou}), then everything else by day (today,
 * yesterday, this week, earlier) in the order given.
 */
export function buildNotificationSections(
  items: readonly Notification[],
  now: () => number,
  titleForKey: (key: string) => string = (key) => SECTION_TITLES[key] ?? key
): readonly NotificationSection[] {
  const buckets = new Map<string, Notification[]>();
  for (const item of items) {
    const key = notificationNeedsYou(item)
      ? NEEDS_YOU_SECTION_KEY
      : sectionKeyForDate(item.createdAt, now);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const order = [
    NEEDS_YOU_SECTION_KEY,
    'today',
    'yesterday',
    'this_week',
    'earlier',
  ];
  const sections: NotificationSection[] = [];
  for (const key of order) {
    const bucket = buckets.get(key);
    if (bucket === undefined || bucket.length === 0) continue;
    sections.push({
      key,
      title: titleForKey(key),
      items:
        key === NEEDS_YOU_SECTION_KEY
          ? [...bucket].sort(compareNeedsYou)
          : bucket,
    });
  }
  return sections;
}
