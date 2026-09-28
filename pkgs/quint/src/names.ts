/**
 * The names a Quint spec declares, read statically so the glossary gate can
 * hold every product-facing identifier to the bounded context's ubiquitous
 * language (`specs/<domain>/ubiquitous-language.yml`).
 *
 * Only top-level declarations count — the module's own two-space-indented
 * `type` / `var` / `const` / `val` / `def` / `action` lines and the variants
 * of its sum types. Locals, parameters and `nondet` picks are the model's
 * working, not its vocabulary.
 */

export type QuintDeclarationKind =
  | 'type'
  | 'variant'
  | 'var'
  | 'const'
  | 'val'
  | 'def'
  | 'action';

export type QuintDeclaration = {
  readonly name: string;
  readonly kind: QuintDeclarationKind;
  /** 1-based source line. */
  readonly line: number;
};

export type QuintImport = {
  /** As written: `events.*`, `events.GameEnded`. */
  readonly what: string;
  /** As written: `../play/events`. */
  readonly from: string;
  readonly line: number;
};

export type QuintNames = {
  /** The `module <name>` the file declares, or null. */
  readonly module: string | null;
  readonly imports: readonly QuintImport[];
  readonly declarations: readonly QuintDeclaration[];
};

/** Blank comments and strings out, keeping line numbers and columns. */
function blankNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => `"${' '.repeat(m.length - 2)}"`);
}

const MODULE = /^module\s+([A-Za-z_]\w*)/m;
const IMPORT = /^\s*import\s+([\w.*]+)(?:\s+as\s+\w+)?\s+from\s+"([^"]+)"/;
const DECLARATION =
  /^ {2}(?:pure\s+)?(type|var|const|val|def|action)\s+([A-Za-z_]\w*)/;
/** A line that ends a type's right-hand side: the next declaration or the module's `}`. */
const TOP_LEVEL = /^ {0,2}\S/;

/** Variants of a sum type's right-hand side, or none for an alias. */
function variantsOf(rhs: string): readonly string[] {
  const body = rhs.trim();
  if (body.startsWith('{')) return [];
  // Only a sum has a top-level `|`; drop payloads so their types don't count.
  let depth = 0;
  let flat = '';
  for (const ch of body) {
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    else if (depth === 0) flat += ch;
  }
  if (!flat.includes('|')) return [];
  return flat
    .split('|')
    .map((part) => /^\s*([A-Za-z_]\w*)/.exec(part)?.[1])
    .filter((name): name is string => name !== undefined);
}

/** A sum type's variants, where each is first written after line `from`. */
function typeVariants(
  lines: readonly string[],
  from: number
): readonly QuintDeclaration[] {
  const head = lines[from] ?? '';
  if (!head.includes('=')) return [];
  // The right-hand side runs to the next top-level line.
  let rhs = head.slice(head.indexOf('=') + 1);
  for (
    let end = from + 1;
    end < lines.length && !TOP_LEVEL.test(lines[end] ?? '');
    end += 1
  ) {
    rhs += `\n${lines[end] ?? ''}`;
  }
  return variantsOf(rhs).map((name) => {
    const pattern = new RegExp(`(^|[|\\s])${name}\\b`);
    const at = lines.findIndex(
      (text, index) => index >= from && pattern.test(text)
    );
    return { name, kind: 'variant', line: at + 1 };
  });
}

export function quintNames(source: string): QuintNames {
  const clean = blankNoise(source);
  const lines = clean.split('\n');
  // Raw lines keep the import path (strings are blanked in `clean`).
  const raw = source.split('\n');
  const imports: QuintImport[] = [];
  const declarations: QuintDeclaration[] = [];
  lines.forEach((line, i) => {
    const imported = /^\s*import\b/.test(line)
      ? IMPORT.exec(raw[i] ?? '')
      : null;
    if (imported !== null) {
      imports.push({
        what: imported[1] ?? '',
        from: imported[2] ?? '',
        line: i + 1,
      });
      return;
    }
    const match = DECLARATION.exec(line);
    if (match === null) return;
    const kind = match[1] as Exclude<QuintDeclarationKind, 'variant'>;
    declarations.push({ name: match[2] ?? '', kind, line: i + 1 });
    if (kind === 'type') declarations.push(...typeVariants(lines, i));
  });
  return {
    module: MODULE.exec(clean)?.[1] ?? null,
    imports,
    declarations,
  };
}
