/**
 * The fix prompt `check:heal` hands its agent: every failing step's captured
 * output, cleaned of ANSI colour and CI timestamps and trimmed to its head and
 * tail, under the repo's non-negotiable constraints.
 */

const MAX_LINES_PER_BLOCK = 200;
const HEAD_LINES_KEPT = 5;

const CONSTRAINTS = [
  'Never patch dependencies (`bun patch`, `patch-package`, `patches/`, etc.).',
  'Never disable the Tiger-style Biome size limits (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, etc.). Refactor instead.',
  'Fix the root cause; do not suppress rules or add blanket biome-ignore comments.',
  'Do not create git commits unless explicitly asked.',
  'After edits, re-run the failing step(s) to verify before finishing.',
] as const;

function cleanLine(line: string): string {
  return line
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/, '')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\u001b\][^\u0007]*\u0007/g, '');
}

function trimBlock(block: string): string {
  const lines = block.split('\n');
  if (lines.length <= MAX_LINES_PER_BLOCK) return block;
  const tailCount = MAX_LINES_PER_BLOCK - HEAD_LINES_KEPT;
  const omitted = lines.length - HEAD_LINES_KEPT - tailCount;
  return [
    ...lines.slice(0, HEAD_LINES_KEPT),
    `... (truncated ${String(omitted)} lines; showing first ${String(HEAD_LINES_KEPT)} and last ${String(tailCount)}) ...`,
    ...lines.slice(-tailCount),
  ].join('\n');
}

/** Plain-text prompt body for the `check:heal` agent loop. */
export function buildCheckHealPromptBody(
  failures: ReadonlyArray<{ readonly stepId: string; readonly output: string }>
): string {
  if (failures.length === 0) return '';
  const lines = [
    '# Fix `bun check:local` failures',
    '',
    'The `bun check:local` gates failed when run locally via `bun run check:heal`.',
    '',
    'For each failing step below, identify the root cause from the captured output and fix it — do not just suppress the rule. Prefer fixing all failures together when they share a root cause. After fixing, re-run `bun run check:heal` (or `bun run check`) to verify.',
    '',
    'Constraints:',
    ...CONSTRAINTS.map((c) => `- ${c}`),
    '',
  ];
  for (const f of failures) {
    const output = f.output.split(/\r?\n/).map(cleanLine).join('\n').trimEnd();
    lines.push(
      `## \`${f.stepId}\``,
      '',
      '```text',
      trimBlock(output),
      '```',
      ''
    );
  }
  return lines.join('\n').trimEnd();
}
