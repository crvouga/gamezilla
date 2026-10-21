/**
 * Decision tables for tests, written as rows instead of XML: `dmnTable`
 * renders the DMN document, `decisionOf` reads it back as the one decision.
 */

import type { DmnDecision } from '@pkgs/dmn-shared-ts/model';
import { parseDmn } from '@pkgs/dmn-shared-ts/model';
import { escapeXml } from '@pkgs/dmn-shared-ts/xml';

export type TableSpec = {
  readonly id?: string;
  readonly hitPolicy?: string;
  readonly inputs: readonly {
    readonly name: string;
    readonly typeRef: string;
    readonly values?: string;
  }[];
  readonly outputs: readonly {
    readonly name: string;
    readonly typeRef: string;
    readonly values?: string;
  }[];
  readonly rules: readonly {
    readonly id: string;
    readonly in: readonly string[];
    readonly out: readonly string[];
  }[];
};

const text = (value: string) => `<text>${escapeXml(value)}</text>`;

export function dmnTable(spec: TableSpec): string {
  const id = spec.id ?? 'table';
  const policy =
    spec.hitPolicy === undefined ? '' : ` hitPolicy="${spec.hitPolicy}"`;
  const inputs = spec.inputs.map((input, i) =>
    [
      `<input id="in-${String(i)}" label="${escapeXml(input.name)}">`,
      `<inputExpression typeRef="${input.typeRef}">${text(input.name)}</inputExpression>`,
      input.values === undefined
        ? ''
        : `<inputValues>${text(input.values)}</inputValues>`,
      '</input>',
    ].join('')
  );
  const outputs = spec.outputs.map((output, i) =>
    [
      `<output id="out-${String(i)}" name="${escapeXml(output.name)}" typeRef="${output.typeRef}">`,
      output.values === undefined
        ? ''
        : `<outputValues>${text(output.values)}</outputValues>`,
      '</output>',
    ].join('')
  );
  const rules = spec.rules.map((rule) =>
    [
      `<rule id="${rule.id}">`,
      ...rule.in.map((cell) => `<inputEntry>${text(cell)}</inputEntry>`),
      ...rule.out.map((cell) => `<outputEntry>${text(cell)}</outputEntry>`),
      '</rule>',
    ].join('')
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<dmn:definitions xmlns:dmn="https://www.omg.org/spec/DMN/20191111/MODEL/" id="defs" name="Test">',
    `<dmn:decision id="${id}" name="${id}">`,
    `<dmn:decisionTable id="${id}-table"${policy}>`,
    ...inputs,
    ...outputs,
    ...rules,
    '</dmn:decisionTable></dmn:decision></dmn:definitions>',
  ]
    .join('\n')
    .replace(
      /<(\/?)(input|inputExpression|inputValues|output|outputValues|rule|inputEntry|outputEntry|text)\b/g,
      '<$1dmn:$2'
    );
}

export function decisionOf(spec: TableSpec): DmnDecision {
  const parsed = parseDmn(dmnTable(spec));
  if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
  const [decision] = parsed.definitions.decisions;
  if (decision === undefined) throw new Error('no decision');
  return decision;
}
