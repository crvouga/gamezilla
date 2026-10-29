/** Markdown helpers for the inventory tables. */

/** A table cell: one line, pipes escaped. */
export function cell(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .trim();
}

export function code(text: string): string {
  return text === '' ? '' : `\`${text.replace(/`/g, "'")}\``;
}

export function table(
  head: readonly string[],
  rows: readonly (readonly string[])[]
): string[] {
  if (rows.length === 0) return ['_none_'];
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
}
