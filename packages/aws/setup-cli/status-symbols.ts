/** Terminal-friendly markers for setup/status CLIs (UTF-8). */
export const statusSym = {
  ok: '✓',
  fail: '✗',
  warn: '⚠',
  skip: '○',
  bullet: '·',
} as const;

export function statusRule(char: string, label: string, detail?: string): string {
  const d = detail !== undefined && detail !== '' ? ` — ${detail}` : '';
  return `${char} ${label}${d}`;
}
