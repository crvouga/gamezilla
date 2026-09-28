export function normalizeHarnessNodeId(id: string, prefix: string): string {
  const normalized = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized === prefix ? `${prefix}-a` : normalized;
}

export function nextHarnessNodeId(
  prefix: string,
  taken: ReadonlySet<string>
): string {
  let index = 0;
  while (taken.has(`${prefix}-${letterSuffix(index)}`)) index += 1;
  return `${prefix}-${letterSuffix(index)}`;
}

function letterSuffix(index: number): string {
  let value = index + 1;
  let suffix = '';
  while (value > 0) {
    value -= 1;
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return suffix;
}
