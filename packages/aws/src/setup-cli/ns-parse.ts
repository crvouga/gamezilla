import { assert } from '@gamezilla/shared/assert';

export function parseNameservers(raw: string): Set<string> {
  assert.string(raw, 'parseNameservers: raw must be a string');
  const entries = raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
    .filter((s) => s.length > 0);
  const set = new Set(entries);
  if (set.size !== entries.length) {
    throw new Error('parseNameservers: duplicate entries in input');
  }
  return set;
}
