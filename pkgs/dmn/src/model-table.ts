/**
 * One `<decisionTable>` read into inputs, outputs and rules, with every cell
 * parsed and checked against the column it sits in: a test that can never
 * match its input (a typo like `"plsu"`, a string compared by order) is an
 * issue, not a silently dead rule.
 */

import {
  type Domain,
  fitsType,
  inDomain,
  parseDomain,
  renderDomain,
  TYPE_REFS,
  type TypeRef,
} from './domain';
import {
  equalityLiterals,
  type FeelValue,
  parseLiteral,
  parseUnaryTests,
  renderFeelValue,
  type UnaryTest,
  usesOrder,
} from './feel';
import type { DmnInput, DmnOutput, DmnRule, HitPolicy } from './model';
import { childElements, textOf, type XmlElement } from './xml';

export type Issues = {
  readonly list: string[];
  readonly source: string;
  readonly add: (element: XmlElement, message: string) => void;
};

type TableContext = { readonly decisionId: string; readonly issues: Issues };

type Table = {
  readonly hitPolicy: HitPolicy;
  readonly inputs: readonly DmnInput[];
  readonly outputs: readonly DmnOutput[];
  readonly rules: readonly DmnRule[];
};

const POLICIES: Readonly<Record<string, HitPolicy>> = {
  UNIQUE: 'UNIQUE',
  FIRST: 'FIRST',
  ANY: 'ANY',
  PRIORITY: 'PRIORITY',
};

/** The table, or `null` when it has issues (added to `ctx.issues`). */
export function readTable(table: XmlElement, ctx: TableContext): Table | null {
  const before = ctx.issues.list.length;
  const policyText = table.attributes.get('hitPolicy') ?? 'UNIQUE';
  const hitPolicy = POLICIES[policyText];
  if (hitPolicy === undefined) {
    add(
      ctx,
      table,
      `hit policy ${policyText} is not supported (UNIQUE, FIRST, ANY, PRIORITY)`
    );
  }
  if (table.attributes.has('aggregation')) {
    add(ctx, table, 'aggregation is not supported');
  }
  const inputs = childElements(table, 'input').map((el) => readInput(el, ctx));
  const outputs = childElements(table, 'output').map((el) =>
    readOutput(el, ctx)
  );
  if (outputs.length === 0) add(ctx, table, 'the table has no output');
  checkNames(table, ctx, [...inputs, ...outputs]);
  const cleanInputs = inputs.filter((i): i is DmnInput => i !== null);
  const cleanOutputs = outputs.filter((o): o is DmnOutput => o !== null);
  if (hitPolicy === 'PRIORITY') checkPriorities(table, ctx, cleanOutputs);
  if (ctx.issues.list.length > before || hitPolicy === undefined) return null;
  const columns = { inputs: cleanInputs, outputs: cleanOutputs };
  const rules = childElements(table, 'rule').map((el) =>
    readRule(el, { ctx, ...columns })
  );
  if (ctx.issues.list.length > before) return null;
  return {
    hitPolicy,
    ...columns,
    rules: rules.filter((r): r is DmnRule => r !== null),
  };
}

function add(ctx: TableContext, element: XmlElement, message: string): void {
  ctx.issues.add(element, `decision ${ctx.decisionId}: ${message}`);
}

/** The `<text>` of a DMN element (`inputEntry`, `inputValues`, …). */
function cellText(
  element: XmlElement,
  ctx: TableContext,
  what: string
): string | null {
  const [text] = childElements(element, 'text');
  if (text === undefined) {
    add(ctx, element, `${what} has no <text>`);
    return null;
  }
  return textOf(text).trim();
}

function readTypeRef(
  element: XmlElement,
  ctx: TableContext,
  what: string
): TypeRef | null {
  const typeRef = element.attributes.get('typeRef');
  const known = TYPE_REFS.find((t) => t === typeRef);
  if (known === undefined) {
    add(
      ctx,
      element,
      `${what}: typeRef must be string, number or boolean (got ${String(typeRef)})`
    );
    return null;
  }
  return known;
}

function readInput(element: XmlElement, ctx: TableContext): DmnInput | null {
  const id = element.attributes.get('id') ?? '';
  const [expression] = childElements(element, 'inputExpression');
  if (expression === undefined) {
    add(ctx, element, `input ${id} has no <inputExpression>`);
    return null;
  }
  const name = cellText(expression, ctx, `input ${id}`);
  const typeRef = readTypeRef(expression, ctx, `input ${id}`);
  const [values] = childElements(element, 'inputValues');
  if (values === undefined) {
    add(
      ctx,
      element,
      `input ${name ?? id} must declare its domain in <inputValues>`
    );
    return null;
  }
  const domainText = cellText(values, ctx, `input ${id} values`);
  if (name === null || typeRef === null || domainText === null) return null;
  if (name === '') add(ctx, expression, `input ${id} has an empty name`);
  const domain = parseDomain(domainText, typeRef);
  if (!domain.ok) {
    add(ctx, values, `input ${name}: ${domain.error}`);
    return null;
  }
  const label = element.attributes.get('label') ?? name;
  return { id, label, name, typeRef, domain: domain.value };
}

function readOutput(element: XmlElement, ctx: TableContext): DmnOutput | null {
  const id = element.attributes.get('id') ?? '';
  const name = element.attributes.get('name') ?? '';
  if (name === '') add(ctx, element, `output ${id} needs a name`);
  const typeRef = readTypeRef(element, ctx, `output ${id}`);
  if (typeRef === null || name === '') return null;
  const [valuesElement] = childElements(element, 'outputValues');
  if (valuesElement === undefined) return { id, name, typeRef, values: null };
  const text = cellText(valuesElement, ctx, `output ${name} values`);
  if (text === null) return null;
  const domain = parseDomain(text, typeRef);
  if (!domain.ok || domain.value.kind !== 'values') {
    const why = domain.ok ? 'list the values, not a range' : domain.error;
    add(ctx, valuesElement, `output ${name}: ${why}`);
    return null;
  }
  return { id, name, typeRef, values: domain.value.values };
}

function checkNames(
  table: XmlElement,
  ctx: TableContext,
  columns: readonly ({ readonly name: string } | null)[]
): void {
  const seen = new Set<string>();
  for (const column of columns) {
    if (column === null) continue;
    if (seen.has(column.name))
      add(ctx, table, `"${column.name}" names two columns`);
    seen.add(column.name);
  }
}

function checkPriorities(
  table: XmlElement,
  ctx: TableContext,
  outputs: readonly DmnOutput[]
): void {
  for (const output of outputs) {
    if (output.values === null) {
      add(
        ctx,
        table,
        `PRIORITY needs outputValues on output ${output.name} (they rank the answers)`
      );
    }
  }
}

type RuleColumns = {
  readonly ctx: TableContext;
  readonly inputs: readonly DmnInput[];
  readonly outputs: readonly DmnOutput[];
};

function readRule(element: XmlElement, columns: RuleColumns): DmnRule | null {
  const { ctx, inputs, outputs } = columns;
  const id = element.attributes.get('id') ?? '';
  if (id === '') {
    add(ctx, element, 'a rule needs an id (reports name rules by it)');
    return null;
  }
  const inputCells = childElements(element, 'inputEntry');
  const outputCells = childElements(element, 'outputEntry');
  if (inputCells.length !== inputs.length) {
    add(
      ctx,
      element,
      `rule ${id} has ${String(inputCells.length)} input entries for ${String(inputs.length)} inputs`
    );
    return null;
  }
  if (outputCells.length !== outputs.length) {
    add(
      ctx,
      element,
      `rule ${id} has ${String(outputCells.length)} output entries for ${String(outputs.length)} outputs`
    );
    return null;
  }
  const inputEntries = inputCells.map((cell, i) =>
    readInputEntry(cell, { ctx, rule: id, input: inputs[i] })
  );
  const outputEntries = outputCells.map((cell, i) =>
    readOutputEntry(cell, { ctx, rule: id, output: outputs[i] })
  );
  const [description] = childElements(element, 'description');
  if (inputEntries.includes(undefined) || outputEntries.includes(undefined)) {
    return null;
  }
  return {
    id,
    description:
      description === undefined ? null : textOf(description).trim() || null,
    inputEntries: inputEntries.filter((t): t is UnaryTest => t !== undefined),
    outputEntries: outputEntries.filter((v): v is FeelValue => v !== undefined),
  };
}

function readInputEntry(
  cell: XmlElement,
  at: { ctx: TableContext; rule: string; input: DmnInput | undefined }
): UnaryTest | undefined {
  const { ctx, rule, input } = at;
  const text = cellText(cell, ctx, `rule ${rule} input entry`);
  if (text === null || input === undefined) return undefined;
  const parsed = parseUnaryTests(text);
  if (!parsed.ok) {
    add(ctx, cell, `rule ${rule}, ${input.name}: ${parsed.error}`);
    return undefined;
  }
  const problems = entryProblems(parsed.value, input);
  for (const problem of problems) {
    add(ctx, cell, `rule ${rule}, ${input.name}: ${problem}`);
  }
  return problems.length === 0 ? parsed.value : undefined;
}

/** Why a test can never do what it says on this input. */
function entryProblems(test: UnaryTest, input: DmnInput): string[] {
  const problems: string[] = [];
  if (usesOrder(test) && input.typeRef !== 'number') {
    problems.push(`compares by order, but ${input.name} is a ${input.typeRef}`);
  }
  for (const literal of equalityLiterals(test)) {
    if (!fitsType(literal, input.typeRef)) {
      problems.push(`${renderFeelValue(literal)} is not a ${input.typeRef}`);
    } else if (!inDomain(input.domain, literal)) {
      problems.push(outsideDomain(literal, input.domain));
    }
  }
  return problems;
}

function outsideDomain(value: FeelValue, domain: Domain): string {
  return `${renderFeelValue(value)} is outside the declared values (${renderDomain(domain)})`;
}

function readOutputEntry(
  cell: XmlElement,
  at: { ctx: TableContext; rule: string; output: DmnOutput | undefined }
): FeelValue | undefined {
  const { ctx, rule, output } = at;
  const text = cellText(cell, ctx, `rule ${rule} output entry`);
  if (text === null || output === undefined) return undefined;
  const parsed = parseLiteral(text);
  if (!parsed.ok) {
    add(ctx, cell, `rule ${rule}, ${output.name}: ${parsed.error}`);
    return undefined;
  }
  const value = parsed.value;
  if (!fitsType(value, output.typeRef)) {
    add(
      ctx,
      cell,
      `rule ${rule}, ${output.name}: ${renderFeelValue(value)} is not a ${output.typeRef}`
    );
    return undefined;
  }
  if (output.values !== null && !output.values.includes(value)) {
    add(
      ctx,
      cell,
      `rule ${rule}, ${output.name}: ${outsideDomain(value, { kind: 'values', values: output.values })}`
    );
    return undefined;
  }
  return value;
}
