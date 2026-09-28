/**
 * Static extraction of step definitions from a steps source file, so the spec
 * check needs no runtime (no harness, no DOM): `Given('text', …)` with a plain
 * string literal. Anything else as the first argument is a violation, so the
 * runtime registry and this view cannot drift.
 */

import type { StepKind } from './registry';

export type ExtractedStep = {
  readonly kind: StepKind;
  readonly text: string;
  readonly file: string;
  readonly line: number;
  readonly pending: boolean;
};

export type Extraction = {
  readonly steps: readonly ExtractedStep[];
  readonly problems: readonly string[];
};

const CALL = /\b(Given|When|Then|Step)\(\s*/g;
const LITERAL = /^(['"])((?:\\.|(?!\1)[^\\\n])*)\1/;

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function unescape(literal: string): string {
  return literal.replace(/\\(['"\\])/g, '$1');
}

/** Whether the definition's body is `pending(…)` (a marker the check reports). */
function bodyIsPending(source: string, from: number): boolean {
  const rest = source.slice(from, from + 200);
  return /^\s*,\s*pending\(/.test(rest);
}

export function extractSteps(source: string, file: string): Extraction {
  const steps: ExtractedStep[] = [];
  const problems: string[] = [];
  for (const call of source.matchAll(CALL)) {
    const start = call.index + call[0].length;
    const literal = LITERAL.exec(source.slice(start));
    const line = lineOf(source, call.index);
    if (literal === null) {
      problems.push(
        `${file}:${String(line)}: ${call[1] ?? 'Step'}(…) must take a plain string literal (the catalog and the spec check read it statically)`
      );
      continue;
    }
    steps.push({
      kind: call[1] as StepKind,
      text: unescape(literal[2] ?? ''),
      file,
      line,
      pending: bodyIsPending(source, start + literal[0].length),
    });
  }
  return { steps, problems };
}

/** Bare specifiers of other packages' step modules a steps entry imports. */
export function extractStepImports(source: string): readonly string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[1] ?? '';
    if (specifier.startsWith('@')) out.push(specifier);
  }
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
    const specifier = match[1] ?? '';
    if (specifier.startsWith('@')) out.push(specifier);
  }
  return out;
}
