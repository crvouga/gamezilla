import { forEachFrontCoded } from './word-tiles-lexicon-codec';

/**
 * Exact membership and prefix navigation over a word list, in four typed
 * arrays (a first-child / next-sibling trie): about 390 000 nodes for the
 * production list, roughly 4 MB, built in one pass over the artifact. Letters
 * are `0`–`25` for `A`–`Z`; node `0` is the empty prefix.
 */
export type WordTrie = {
  readonly words: number;
  readonly nodes: number;
  /** The node after `letter` from `node`, or `-1`. */
  readonly child: (node: number, letter: number) => number;
  readonly terminal: (node: number) => boolean;
  /** Each child of `node`, in letter order. */
  readonly forEachChild: (
    node: number,
    visit: (letter: number, child: number) => void
  ) => void;
};

export const ROOT_NODE = 0;

/** The trie of a front-coded artifact. */
export function buildWordTrie(artifact: string): WordTrie {
  const capacity = artifact.length + 1;
  const letter = new Uint8Array(capacity);
  const terminal = new Uint8Array(capacity);
  const firstChild = new Int32Array(capacity).fill(-1);
  const nextSibling = new Int32Array(capacity).fill(-1);
  const lastChild = new Int32Array(capacity).fill(-1);
  let size = 1;
  let words = 0;
  const path: number[] = [ROOT_NODE];
  forEachFrontCoded(artifact, (word, shared) => {
    path.length = shared + 1;
    for (let at = shared; at < word.length; at++) {
      const parent = path[path.length - 1]!;
      const node = size++;
      letter[node] = word.charCodeAt(at) - 97;
      const last = lastChild[parent]!;
      if (last === -1) firstChild[parent] = node;
      else nextSibling[last] = node;
      lastChild[parent] = node;
      path.push(node);
    }
    terminal[path[path.length - 1]!] = 1;
    words++;
  });
  return {
    words,
    nodes: size,
    child: (node, wanted) => {
      for (let c = firstChild[node]!; c !== -1; c = nextSibling[c]!)
        if (letter[c] === wanted) return c;
      return -1;
    },
    terminal: (node) => terminal[node] === 1,
    forEachChild: (node, visit) => {
      for (let c = firstChild[node]!; c !== -1; c = nextSibling[c]!)
        visit(letter[c]!, c);
    },
  };
}

/** Whether `trie` holds `word`, written in `A`–`Z`. */
export function trieHas(trie: WordTrie, word: string): boolean {
  let node = ROOT_NODE;
  for (let at = 0; at < word.length; at++) {
    const code = word.charCodeAt(at) - 65;
    if (code < 0 || code > 25) return false;
    node = trie.child(node, code);
    if (node === -1) return false;
  }
  return trie.terminal(node);
}
