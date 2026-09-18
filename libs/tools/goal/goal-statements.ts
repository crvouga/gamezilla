/**
 * Parses `goal.md` into stable, id-addressable statements.
 *
 * Ids are `${sectionSlug}:${ordinal}` where the ordinal is 1-based within the
 * `## ` section under `# Definition of done`. Reordering bullets changes ids,
 * so `goal.md` carries a do-not-reorder comment.
 */

export type GoalStatement = {
  readonly id: string;
  readonly section: string;
  readonly ordinal: number;
  readonly text: string;
  readonly checked: boolean;
};

const DEFINITION_HEADING = /^#\s+Definition of done\s*$/;
const TOP_LEVEL_HEADING = /^#\s+\S/;
const SECTION_HEADING = /^##\s+(.*\S)\s*$/;
const CHECKBOX_ITEM = /^\s*- \[( |x)\] (.*\S)\s*$/;

export function slugifySection(heading: string): string {
  return heading
    .replace(/^\s*\d+[.)]\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function goalStatementId(sectionSlug: string, ordinal: number): string {
  return `${sectionSlug}:${ordinal}`;
}

export function parseGoalMarkdown(markdown: string): readonly GoalStatement[] {
  const statements: GoalStatement[] = [];
  let inDefinition = false;
  let sectionSlug: string | null = null;
  let ordinal = 0;

  for (const line of markdown.split('\n')) {
    if (DEFINITION_HEADING.test(line)) {
      inDefinition = true;
      sectionSlug = null;
      ordinal = 0;
      continue;
    }
    if (!inDefinition) continue;
    if (TOP_LEVEL_HEADING.test(line)) break;

    const section = SECTION_HEADING.exec(line);
    if (section !== null) {
      sectionSlug = slugifySection(section[1] ?? '');
      ordinal = 0;
      continue;
    }

    const item = CHECKBOX_ITEM.exec(line);
    if (item === null || sectionSlug === null) continue;

    ordinal += 1;
    statements.push({
      id: goalStatementId(sectionSlug, ordinal),
      section: sectionSlug,
      ordinal,
      text: (item[2] ?? '').trim(),
      checked: item[1] === 'x',
    });
  }

  return statements;
}
