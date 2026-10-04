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

const SECTION_TITLES: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  earlier: 'Earlier',
};

export function buildNotificationSections(
  items: readonly Notification[],
  now: () => number,
  titleForKey: (key: string) => string = (key) => SECTION_TITLES[key] ?? key
): readonly NotificationSection[] {
  const buckets = new Map<string, Notification[]>();
  for (const item of items) {
    const key = sectionKeyForDate(item.createdAt, now);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const order = ['today', 'yesterday', 'this_week', 'earlier'];
  const sections: NotificationSection[] = [];
  for (const key of order) {
    const bucket = buckets.get(key);
    if (bucket === undefined || bucket.length === 0) continue;
    sections.push({
      key,
      title: titleForKey(key),
      items: bucket,
    });
  }
  return sections;
}
