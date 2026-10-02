import type {
  FeedbackBody,
  FeedbackDraft,
  FeedbackKind,
  FeedbackSection,
} from './types';

const FALLBACK_TITLES: Record<FeedbackKind, string> = {
  problem: 'Bug report',
  feature: 'Feature request',
  gap: 'Product gap',
  polish: 'Polish feedback',
};

function section(
  heading: string | null,
  lines: readonly string[]
): FeedbackSection | null {
  const content = lines.join('\n').trim();
  return heading === null && content.length === 0 ? null : { heading, content };
}

export function parseFeedbackSections(
  source: string
): readonly FeedbackSection[] {
  const sections: FeedbackSection[] = [];
  let heading: string | null = null;
  let lines: string[] = [];
  let fenced = false;
  for (const line of source.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const match = fenced ? null : /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (!match) {
      lines.push(line);
      continue;
    }
    const previous = section(heading, lines);
    if (previous) sections.push(previous);
    heading = match[1] ?? null;
    lines = [];
  }
  const final = section(heading, lines);
  if (final) sections.push(final);
  return sections;
}

export function createFeedbackBody(source: string): FeedbackBody {
  return {
    format: 'markdown',
    source,
    sections: parseFeedbackSections(source),
  };
}

function firstContentLine(body: FeedbackBody): string | undefined {
  for (const item of body.sections) {
    const line = item.content
      .split('\n')
      .map((value) => value.trim())
      .find(Boolean);
    if (line) return line.replace(/^[-*+]\s+/, '').slice(0, 240);
  }
  return undefined;
}

export function resolveFeedbackTitle(draft: FeedbackDraft): string {
  const title = draft.title.trim();
  if (title) return title;
  return (
    firstContentLine(createFeedbackBody(draft.body)) ??
    FALLBACK_TITLES[draft.kind]
  );
}
