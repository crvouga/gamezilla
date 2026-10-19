/**
 * The product-facing names of an Alloy structure (`specs/<domain>/*.als`):
 * its signatures and their fields. Like a Quint model's names, each must be
 * some term's `model` in the context's ubiquitous language, so
 * `spec-glossary.ts` hands them to the same verification (`@pkgs/gherkin/glossary`).
 *
 * A small regex reader, not a parser: comments are blanked (lines kept), then
 * every `[abstract|one|lone|some|var] sig A, B [extends C | in C] { … }` gives
 * its names, and each `name[, name]: <multiplicity> Type` at the top level of
 * its body gives fields. Facts, predicates and assertions are the structure's
 * own and need no term.
 */

export type AlloyDeclaration = {
  readonly name: string;
  readonly kind: 'sig' | 'field';
  readonly line: number;
};

/** Blank `//`, `--` and block comments, keeping every newline and offset. */
function stripComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(?:\/\/|--)[^\n]*/g, blank);
}

const SIG =
  /\b(?:(?:abstract|one|lone|some|var|private)\s+)*sig\s+([A-Za-z_][\w'"]*(?:\s*,\s*[A-Za-z_][\w'"]*)*)\s*(?:(?:extends|in)\s+[^{]*)?\{/g;

const NAME = /^[A-Za-z_][\w'"]*$/;

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

/** The body of the sig whose `{` is at `open`, up to its matching `}`. */
function bodyAt(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** Top-level comma-separated pieces of a sig body, with their offsets. */
function pieces(
  body: string
): readonly { readonly text: string; readonly at: number }[] {
  const out: { text: string; at: number }[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= body.length; i++) {
    const c = body[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if ((c === ',' || c === undefined) && depth === 0) {
      out.push({ text: body.slice(start, i), at: start });
      start = i + 1;
    }
  }
  return out;
}

const FIELD_NAMES =
  /^\s*(?:var\s+)?([A-Za-z_][\w'"]*(?:\s*,\s*[A-Za-z_][\w'"]*)*)\s*:/;

function fieldsOf(
  text: string,
  bodyStart: number,
  body: string
): AlloyDeclaration[] {
  const out: AlloyDeclaration[] = [];
  // `a, b: set X` splits at the comma: carry names until a piece has a colon.
  let pending: { name: string; at: number }[] = [];
  for (const piece of pieces(body)) {
    const trimmed = piece.text.trim();
    const offset = bodyStart + piece.at + piece.text.indexOf(trimmed);
    if (NAME.test(trimmed)) {
      pending.push({ name: trimmed, at: offset });
      continue;
    }
    const match = FIELD_NAMES.exec(piece.text);
    if (match !== null) {
      for (const earlier of pending) {
        out.push({
          name: earlier.name,
          kind: 'field',
          line: lineAt(text, earlier.at),
        });
      }
      for (const name of (match[1] ?? '').split(',')) {
        out.push({
          name: name.trim(),
          kind: 'field',
          line: lineAt(text, offset),
        });
      }
    }
    pending = [];
  }
  return out;
}

/** Every sig and field an Alloy source declares, in source order. */
export function alloyNames(source: string): readonly AlloyDeclaration[] {
  const text = stripComments(source);
  const out: AlloyDeclaration[] = [];
  for (const match of text.matchAll(SIG)) {
    const line = lineAt(text, match.index);
    for (const name of (match[1] ?? '').split(',')) {
      out.push({ name: name.trim(), kind: 'sig', line });
    }
    const open = match.index + match[0].length - 1;
    out.push(...fieldsOf(text, open + 1, bodyAt(text, open)));
  }
  return out;
}
