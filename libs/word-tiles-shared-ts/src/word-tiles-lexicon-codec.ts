/**
 * The lexicon's content pipeline, separate from gameplay: normalising an
 * upstream word list into the canonical list, and the front-coded artifact
 * the game ships. Pure; the acquisition script and the tests use it.
 *
 * Canonical list: the distinct words of 2–15 ASCII letters `a`–`z`, sorted
 * by code unit, joined by `\n`. A line holding anything else (punctuation, a
 * capital, an accented letter) is refused, never transformed into another
 * word.
 *
 * Artifact: each word in canonical order as one uppercase marker `A`–`P`
 * (how many leading letters it shares with the previous word, 0–15)
 * followed by its remaining lowercase letters.
 */

export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 15;

export type CanonicalWords = {
  readonly words: readonly string[];
  /** Upstream lines refused: not 2–15 lowercase ASCII letters. */
  readonly refused: readonly string[];
};

/** The canonical word list of an upstream text, one word per line. */
export function canonicalWords(source: string): CanonicalWords {
  const words = new Set<string>();
  const refused: string[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') continue;
    if (/^[a-z]{2,15}$/.test(line)) words.add(line);
    else refused.push(line);
  }
  return { words: [...words].sort(compareCodeUnits), refused };
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalText(words: readonly string[]): string {
  return words.join('\n');
}

function sharedPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

export function encodeFrontCoded(words: readonly string[]): string {
  let previous = '';
  const parts: string[] = [];
  for (const word of words) {
    const shared = Math.min(sharedPrefix(previous, word), MAX_WORD_LENGTH);
    parts.push(String.fromCharCode(65 + shared), word.slice(shared));
    previous = word;
  }
  return parts.join('');
}

/**
 * Visit each word of a front-coded artifact, in order. Fails on a malformed
 * artifact rather than yielding anything that is not a canonical word.
 */
export function forEachFrontCoded(
  artifact: string,
  visit: (word: string, shared: number) => void
): void {
  let previous = '';
  let at = 0;
  while (at < artifact.length) {
    const shared = artifact.charCodeAt(at) - 65;
    if (shared < 0 || shared > MAX_WORD_LENGTH || shared > previous.length)
      throw new Error(`malformed lexicon artifact at ${at}`);
    let end = at + 1;
    while (end < artifact.length) {
      const code = artifact.charCodeAt(end);
      if (code < 97 || code > 122) break;
      end++;
    }
    const word = previous.slice(0, shared) + artifact.slice(at + 1, end);
    if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH)
      throw new Error(`malformed lexicon word at ${at}`);
    visit(word, shared);
    previous = word;
    at = end;
  }
}

export function decodeFrontCoded(artifact: string): readonly string[] {
  const words: string[] = [];
  forEachFrontCoded(artifact, (word) => words.push(word));
  return words;
}

/** Hex SHA-256 of `text` as UTF-8 (content identities and checksums). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
