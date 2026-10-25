import {
  MAX_WORD_LENGTH,
  MIN_WORD_LENGTH,
  sha256Hex,
} from './word-tiles-lexicon-codec';
import { ENABLE_SOURCE } from './word-tiles-lexicon-source';
import { buildWordTrie, trieHas, type WordTrie } from './word-tiles-trie';

/**
 * The lexicon is a versioned gameplay dependency. A match and a puzzle pin
 * its `key`; the authority, bots, client previews and puzzle checks look it
 * up by that key and nothing else, so updating the default list never
 * changes what an existing match or puzzle accepts. Lexicons load
 * asynchronously before play (`loadLexicon`); a key that is not loaded is
 * unavailable, never "every word is valid".
 */
export type LexiconIdentity = {
  /** Pinned in positions and puzzle definitions: `<id>.<first 12 of listSha256>`. */
  readonly key: string;
  readonly id: string;
  readonly version: string;
  readonly words: number;
  /** SHA-256 of the canonical list (see `word-tiles-lexicon-codec`). */
  readonly listSha256: string;
  /** SHA-256 of the shipped front-coded artifact. */
  readonly artifactSha256: string;
  readonly notice: string;
};

export type Lexicon = {
  readonly identity: LexiconIdentity;
  readonly trie: WordTrie;
  /** Exact membership of a normalised word (`A`–`Z`, 2–15 letters). */
  readonly has: (word: string) => boolean;
};

type LexiconEntry = {
  readonly identity: LexiconIdentity;
  readonly artifact: () => Promise<string>;
};

export const ENABLE_LEXICON: LexiconIdentity = {
  key: 'enable1.90ef7a729517',
  id: 'enable1',
  version: 'ENABLE2K',
  words: 168_551,
  listSha256:
    '90ef7a729517b2935581ee272b5c9f0530967699798fb52c84393e93479f599c',
  artifactSha256:
    'e64649d011abd1978702257604695466e6676ee46223120e9b2c7713b5f510f6',
  notice: ENABLE_SOURCE.notice,
};

/**
 * Every lexicon a stored match or puzzle may name. A retired default stays
 * listed for as long as durable content references it.
 */
const CATALOG: readonly LexiconEntry[] = [
  {
    identity: ENABLE_LEXICON,
    // A separate chunk: opening another game never downloads the words.
    artifact: () =>
      import('./word-tiles-lexicon-enable-data').then((m) => m.ENABLE_WORDS),
  },
];

/** The lexicon new matches and puzzles pin. */
export const DEFAULT_LEXICON_KEY = ENABLE_LEXICON.key;

export function lexiconIdentity(key: string): LexiconIdentity | null {
  return CATALOG.find((entry) => entry.identity.key === key)?.identity ?? null;
}

/**
 * A word as the lexicon spells it: ASCII letters only, upper-cased by code
 * point (never by locale), 2–15 letters; `null` for anything else, which is
 * refused rather than turned into another word.
 */
export function normalizeWord(input: string): string | null {
  if (input.length < MIN_WORD_LENGTH || input.length > MAX_WORD_LENGTH)
    return null;
  let word = '';
  for (let at = 0; at < input.length; at++) {
    const code = input.charCodeAt(at);
    if (code >= 65 && code <= 90) word += input[at];
    else if (code >= 97 && code <= 122) word += String.fromCharCode(code - 32);
    else return null;
  }
  return word;
}

/** The lexicon of an artifact, after checking it is the pinned content. */
export async function lexiconFromArtifact(
  identity: LexiconIdentity,
  artifact: string
): Promise<Lexicon> {
  const checksum = await sha256Hex(artifact);
  if (checksum !== identity.artifactSha256)
    throw new LexiconUnavailableError(
      identity.key,
      'the word list does not match its pinned checksum'
    );
  const trie = buildWordTrie(artifact);
  if (trie.words !== identity.words)
    throw new LexiconUnavailableError(
      identity.key,
      'the word list is incomplete'
    );
  return { identity, trie, has: (word) => trieHas(trie, word) };
}

export class LexiconUnavailableError extends Error {
  readonly key: string;
  constructor(key: string, reason: string) {
    super(`Word list ${key} is unavailable: ${reason}`);
    this.key = key;
  }
}

const loaded = new Map<string, Lexicon>();
const loading = new Map<string, Promise<Lexicon>>();

/** The lexicon `key` if it has finished loading in this process. */
export function loadedLexicon(key: string): Lexicon | null {
  return loaded.get(key) ?? null;
}

/** The loaded lexicon `key`, or a {@link LexiconUnavailableError}. */
export function requireLexicon(key: string): Lexicon {
  const lexicon = loaded.get(key);
  if (lexicon !== undefined) return lexicon;
  throw new LexiconUnavailableError(
    key,
    lexiconIdentity(key) === null
      ? 'it is not a known word list'
      : 'it has not loaded'
  );
}

/** Load (once) the lexicon `key`; idempotent and safe to call concurrently. */
export function loadLexicon(key: string): Promise<Lexicon> {
  const ready = loaded.get(key);
  if (ready !== undefined) return Promise.resolve(ready);
  const pending = loading.get(key);
  if (pending !== undefined) return pending;
  const entry = CATALOG.find((e) => e.identity.key === key);
  if (entry === undefined)
    return Promise.reject(
      new LexiconUnavailableError(key, 'it is not a known word list')
    );
  const load = entry
    .artifact()
    .then((artifact) => lexiconFromArtifact(entry.identity, artifact))
    .then((lexicon) => {
      loaded.set(key, lexicon);
      return lexicon;
    })
    .finally(() => loading.delete(key));
  loading.set(key, load);
  return load;
}
