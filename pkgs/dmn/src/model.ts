/**
 * A DMN file (1.3 / 1.4) read into the decision tables it defines. Elements
 * are matched by local name, so any namespace prefix works. Only decision
 * tables are supported, each input must declare its finite domain
 * (`inputValues`), and every cell must parse: a spec that does not read
 * cleanly is reported as issues, never half-read.
 */

import type { Domain, TypeRef } from './domain';
import type { FeelValue, UnaryTest } from './feel';
import { type Issues, readTable } from './model-table';
import {
  childElements,
  locate,
  parseXml,
  textOf,
  XmlError,
  type XmlElement,
} from './xml';

export type HitPolicy = 'UNIQUE' | 'FIRST' | 'ANY' | 'PRIORITY';

export const HIT_POLICIES: readonly HitPolicy[] = [
  'UNIQUE',
  'FIRST',
  'ANY',
  'PRIORITY',
];

export type DmnInput = {
  readonly id: string;
  readonly label: string;
  /** The FEEL name the input is known by (`plays today`). */
  readonly name: string;
  readonly typeRef: TypeRef;
  readonly domain: Domain;
};

export type DmnOutput = {
  readonly id: string;
  readonly name: string;
  readonly typeRef: TypeRef;
  /** `outputValues`, in priority order; `null` when not declared. */
  readonly values: readonly FeelValue[] | null;
};

export type DmnRule = {
  readonly id: string;
  readonly description: string | null;
  /** One per input, in input order. */
  readonly inputEntries: readonly UnaryTest[];
  /** One per output, in output order. */
  readonly outputEntries: readonly FeelValue[];
};

export type DmnDecision = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly hitPolicy: HitPolicy;
  readonly inputs: readonly DmnInput[];
  readonly outputs: readonly DmnOutput[];
  readonly rules: readonly DmnRule[];
};

export type DmnDefinitions = {
  readonly id: string;
  readonly name: string;
  readonly decisions: readonly DmnDecision[];
};

export type ParsedDmn =
  | { readonly ok: true; readonly definitions: DmnDefinitions }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Read a DMN document; every problem found is an issue (`line:col: …`). */
export function parseDmn(xml: string): ParsedDmn {
  let root: XmlElement;
  try {
    root = parseXml(xml);
  } catch (cause) {
    if (cause instanceof XmlError) return { ok: false, issues: [cause.message] };
    throw cause;
  }
  const issues = createIssues(xml);
  if (root.localName !== 'definitions') {
    issues.add(root, `the root is <${root.name}>, not <definitions>`);
  }
  checkUniqueIds(root, issues);
  const decisions: DmnDecision[] = [];
  for (const element of childElements(root, 'decision')) {
    const decision = readDecision(element, issues);
    if (decision !== null) decisions.push(decision);
  }
  if (childElements(root, 'decision').length === 0) {
    issues.add(root, 'the file defines no decision');
  }
  if (issues.list.length > 0) return { ok: false, issues: issues.list };
  return {
    ok: true,
    definitions: {
      id: root.attributes.get('id') ?? '',
      name: root.attributes.get('name') ?? '',
      decisions,
    },
  };
}

/** The decision with this id. */
export function findDecision(
  definitions: DmnDefinitions,
  id: string
): DmnDecision | undefined {
  return definitions.decisions.find((d) => d.id === id);
}

function createIssues(source: string): Issues {
  const list: string[] = [];
  return {
    list,
    source,
    add: (element, message) => {
      const at = locate(source, element.offset);
      list.push(`${String(at.line)}:${String(at.column)}: ${message}`);
    },
  };
}

function readDecision(element: XmlElement, issues: Issues): DmnDecision | null {
  const id = element.attributes.get('id');
  if (id === undefined || id === '') {
    issues.add(element, 'a decision needs an id');
    return null;
  }
  for (const requirement of childElements(element, 'informationRequirement')) {
    if (childElements(requirement, 'requiredDecision').length > 0) {
      issues.add(
        requirement,
        `decision ${id}: decisions that require other decisions are not supported`
      );
    }
  }
  const tables = childElements(element, 'decisionTable');
  const [table] = tables;
  if (tables.length !== 1 || table === undefined) {
    issues.add(element, `decision ${id}: needs exactly one <decisionTable>`);
    return null;
  }
  const read = readTable(table, { decisionId: id, issues });
  if (read === null) return null;
  const description = childElements(element, 'description')[0];
  return {
    id,
    name: element.attributes.get('name') ?? id,
    description:
      description === undefined ? null : textOf(description).trim() || null,
    ...read,
  };
}

function checkUniqueIds(root: XmlElement, issues: Issues): void {
  const seen = new Map<string, XmlElement>();
  const visit = (element: XmlElement): void => {
    const id = element.attributes.get('id');
    if (id !== undefined) {
      if (seen.has(id)) issues.add(element, `id "${id}" is used twice`);
      else seen.set(id, element);
    }
    for (const child of childElements(element)) visit(child);
  };
  visit(root);
}
