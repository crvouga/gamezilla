/**
 * A snapshot's atom ids (uuids, emails, anything a database stores) as Alloy
 * identifiers, deterministically and injectively: two different ids never
 * name the same Alloy variable.
 *
 * `atom_` then each character: an ASCII letter or digit as itself, `_` as
 * `__`, anything else as `_<hex code point>_`. After a `_` the next character
 * is either `_` or a hex digit, never both, so the encoding reads back
 * uniquely. The prefix keeps the name a letter-led identifier; a model name
 * that starts with `atom_` could still collide, which `snapshotProblems`
 * reports.
 */

export const ATOM_PREFIX = 'atom_';

export function alloyAtomId(id: string): string {
  let out = ATOM_PREFIX;
  for (const char of id) {
    if (/^[A-Za-z0-9]$/.test(char)) out += char;
    else if (char === '_') out += '__';
    else out += `_${(char.codePointAt(0) ?? 0).toString(16)}_`;
  }
  return out;
}
