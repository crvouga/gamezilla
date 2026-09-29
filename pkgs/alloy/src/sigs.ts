/**
 * The sigs of a model, complete enough to pin a snapshot. Alloy's receipt
 * lists every sig with its fields, their arities and resolved types, but not
 * the hierarchy: which sig `extends` which, which is `abstract`, which is a
 * `var` sig. Those come from the sig declarations in the source, which this
 * reads without evaluating anything (Alloy has already parsed the same text).
 * Sigs of opened modules (`util/ordering`) are not listed by the receipt and
 * stay out of every snapshot.
 */

import type { FieldInfo, ReceiptSig } from './receipt';

export type Multiplicity = 'set' | 'one' | 'lone' | 'some';

export type SigDeclaration = {
  readonly name: string;
  /** The sig it `extends`, if any. */
  readonly parent: string | null;
  /** The sigs it is declared `in` (a subset sig), else empty. */
  readonly subsetOf: readonly string[];
  readonly abstract: boolean;
  readonly multiplicity: Multiplicity;
  readonly var: boolean;
};

export type SigInfo = SigDeclaration & {
  readonly fields: readonly FieldInfo[];
};

const QUALIFIERS = /\b(var|abstract|private|lone|one|some)\b/g;
const SIG_HEADER =
  /(?<![\w/])((?:(?:var|abstract|private|lone|one|some)\s+)*)sig\s+([^{]*)\{/g;
const ENUM = /(?<![\w/])enum\s+(\w+)\s*\{([^}]*)\}/g;

/** The source without `//`, `--` and block comments. */
export function stripAlloyComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(\/\/|--)[^\n]*/g, '');
}

function localName(name: string): string {
  return name.trim().replace(/^this\//, '');
}

function headerDeclarations(
  qualifierText: string,
  header: string
): SigDeclaration[] {
  const qualifiers = new Set(
    [...qualifierText.matchAll(QUALIFIERS)].map((m) => m[1])
  );
  const multiplicity: Multiplicity = qualifiers.has('one')
    ? 'one'
    : qualifiers.has('lone')
      ? 'lone'
      : qualifiers.has('some')
        ? 'some'
        : 'set';
  const [namesPart = '', relation, targetPart = ''] = header.split(
    /\s+(extends|in)\s+|\s*(?:=)\s*/
  );
  const targets = targetPart
    .split('+')
    .map(localName)
    .filter((t) => t.length > 0);
  const isExtends = relation === 'extends';
  return namesPart
    .split(',')
    .map(localName)
    .filter((name) => name.length > 0)
    .map((name) => ({
      name,
      parent: isExtends ? (targets[0] ?? null) : null,
      subsetOf: isExtends ? [] : targets,
      abstract: qualifiers.has('abstract'),
      multiplicity,
      var: qualifiers.has('var'),
    }));
}

/** Every `sig` and `enum` the source declares, in source order. */
export function sigDeclarations(source: string): readonly SigDeclaration[] {
  const text = stripAlloyComments(source);
  const found: { at: number; declarations: SigDeclaration[] }[] = [];
  for (const match of text.matchAll(SIG_HEADER)) {
    found.push({
      at: match.index,
      declarations: headerDeclarations(match[1] ?? '', match[2] ?? ''),
    });
  }
  for (const match of text.matchAll(ENUM)) {
    const name = match[1] ?? '';
    const values = (match[2] ?? '')
      .split(',')
      .map(localName)
      .filter((v) => v.length > 0);
    const base = { subsetOf: [], var: false } as const;
    found.push({
      at: match.index,
      declarations: [
        { ...base, name, parent: null, abstract: true, multiplicity: 'set' },
        ...values.map((value) => ({
          ...base,
          name: value,
          parent: name,
          abstract: false,
          multiplicity: 'one' as const,
        })),
      ],
    });
  }
  return found.sort((a, b) => a.at - b.at).flatMap((f) => f.declarations);
}

function receiptMultiplicity(cardinality: string): Multiplicity | null {
  return cardinality === 'one' ||
    cardinality === 'lone' ||
    cardinality === 'some' ||
    cardinality === 'set'
    ? cardinality
    : null;
}

/**
 * The receipt's sigs (fields, types) joined with the source's declarations
 * (hierarchy), builtins left out, in the receipt's order.
 */
export function modelSigs(
  receiptSigs: readonly ReceiptSig[],
  source: string
): readonly SigInfo[] {
  const declared = new Map(sigDeclarations(source).map((d) => [d.name, d]));
  return receiptSigs
    .filter((sig) => !sig.builtin)
    .map((sig) => {
      const declaration = declared.get(sig.name);
      const subsetFromType =
        sig.type.length === 1 && sig.type[0] === sig.name ? [] : sig.type;
      return {
        name: sig.name,
        parent: declaration?.parent ?? null,
        subsetOf: declaration?.subsetOf ?? subsetFromType,
        abstract: declaration?.abstract ?? sig.cardinality === 'none',
        multiplicity:
          receiptMultiplicity(sig.cardinality) ??
          declaration?.multiplicity ??
          'set',
        var: declaration?.var ?? false,
        fields: sig.fields,
      };
    });
}
