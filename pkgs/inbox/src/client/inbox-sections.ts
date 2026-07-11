import type { Interaction, InteractionSection } from '../shared/interaction';

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sectionKeyForDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'earlier';
  const today = startOfLocalDay(new Date());
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

export function buildInteractionSections(
  items: readonly Interaction[],
  titleForKey: (key: string) => string = (key) =>
    SECTION_TITLES[key] ?? key
): readonly InteractionSection[] {
  const buckets = new Map<string, Interaction[]>();
  for (const item of items) {
    const key = sectionKeyForDate(item.createdAt);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const order = ['today', 'yesterday', 'this_week', 'earlier'];
  const sections: InteractionSection[] = [];
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
