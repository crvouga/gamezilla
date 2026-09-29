/**
 * An input's declared domain — the values the decision is specified over,
 * from the input's `inputValues`: a list of literals (`"guest","free","plus"`,
 * `true,false`) or a whole-number range (`[0..1000]`). Completeness and case
 * generation are exact because every domain is finite.
 */

import {
  type FeelResult,
  type FeelValue,
  parseUnaryTests,
  renderFeelValue,
  type UnaryTest,
} from './feel';

export type TypeRef = 'string' | 'number' | 'boolean';

export const TYPE_REFS: readonly TypeRef[] = ['string', 'number', 'boolean'];

export type Domain =
  | { readonly kind: 'values'; readonly values: readonly FeelValue[] }
  | { readonly kind: 'range'; readonly min: number; readonly max: number };

/** Parse `inputValues` text for an input of type `typeRef`. */
export function parseDomain(
  text: string,
  typeRef: TypeRef
): FeelResult<Domain> {
  const parsed = parseUnaryTests(text);
  if (!parsed.ok) return parsed;
  const test = parsed.value;
  if (test.kind === 'interval') return rangeDomain(test, typeRef);
  const parts = test.kind === 'or' ? test.tests : [test];
  const values: FeelValue[] = [];
  for (const part of parts) {
    if (part.kind !== 'equal') {
      return fail(
        `domain ${JSON.stringify(text)}: list literals ("a","b") or give a range [0..100]`
      );
    }
    if (!fitsType(part.value, typeRef)) {
      return fail(
        `domain value ${renderFeelValue(part.value)} is not a ${typeRef}`
      );
    }
    if (values.includes(part.value)) {
      return fail(`domain value ${renderFeelValue(part.value)} is repeated`);
    }
    values.push(part.value);
  }
  return { ok: true, value: { kind: 'values', values } };
}

/** Whether `value` is one the domain declares. */
export function inDomain(domain: Domain, value: FeelValue): boolean {
  if (domain.kind === 'values') return domain.values.includes(value);
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= domain.min &&
    value <= domain.max
  );
}

/** Whether `value` has the input's type (`null` fits every type). */
export function fitsType(value: FeelValue, typeRef: TypeRef): boolean {
  return value === null || typeof value === typeRef;
}

export function renderDomain(domain: Domain): string {
  return domain.kind === 'values'
    ? domain.values.map(renderFeelValue).join(', ')
    : `[${String(domain.min)}..${String(domain.max)}]`;
}

function rangeDomain(
  test: Extract<UnaryTest, { kind: 'interval' }>,
  typeRef: TypeRef
): FeelResult<Domain> {
  if (typeRef !== 'number') return fail(`a range needs typeRef "number"`);
  if (!Number.isInteger(test.low) || !Number.isInteger(test.high)) {
    return fail('a range domain is whole numbers: [0..1000]');
  }
  const min = test.lowClosed ? test.low : test.low + 1;
  const max = test.highClosed ? test.high : test.high - 1;
  if (min > max) return fail('the range domain is empty');
  return { ok: true, value: { kind: 'range', min, max } };
}

function fail(error: string): FeelResult<Domain> {
  return { ok: false, error };
}
