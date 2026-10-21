/**
 * Reads a stylesheet into its rules: each selector with the declarations
 * written directly inside it, and the at-rules (`@layer`, `@media`, …) it
 * sits in. This is where a state's look lives (`.btn[data-size="sm"]`).
 */
import type { CssRuleFact } from './inventory-types';

type Frame = { readonly prelude: string; declarations: string };

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

function declarationsOf(text: string): string[] {
  return text
    .split(';')
    .map(squash)
    .filter((d) => d !== '');
}

/** Every rule of one stylesheet that declares something, in source order. */
export function readCssRules(file: string, css: string): CssRuleFact[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack: Frame[] = [];
  const out: CssRuleFact[] = [];
  let buffer = '';
  for (const char of text) {
    if (char === '{') {
      stack.push({ prelude: squash(buffer), declarations: '' });
      buffer = '';
    } else if (char === '}') {
      const frame = stack.pop();
      if (frame !== undefined) {
        const declarations = declarationsOf(`${frame.declarations}${buffer}`);
        if (declarations.length > 0) {
          out.push({
            file,
            context: stack
              .map((f) => f.prelude)
              .filter((p) => p.startsWith('@'))
              .join(' › '),
            selector: frame.prelude,
            declarations,
          });
        }
      }
      buffer = '';
    } else if (char === ';') {
      const frame = stack[stack.length - 1];
      if (frame !== undefined) frame.declarations += `${buffer};`;
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return out;
}
