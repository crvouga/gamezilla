/**
 * The alerting kinds of OpenSLO v1: `AlertCondition` (a burn-rate test),
 * `AlertNotificationTarget` (where an alert goes) and `AlertPolicy` (the
 * conditions that must all hold, and the targets told). Policies and
 * conditions refer to each other by name (`conditionRef`, `targetRef`);
 * inline definitions are not read. Only `burnrate` conditions exist.
 */

import type {
  AlertCondition,
  AlertNotificationTarget,
  AlertPolicy,
  Operator,
} from './model';
import { OPERATORS } from './model';
import type { Cursor, Mapping } from './parse-fields';
import {
  isMapping,
  readBoolean,
  readDuration,
  readMapping,
  readMetadata,
  readOneOf,
  readOptionalString,
  readString,
  report,
} from './parse-fields';

export function readAlertCondition(
  at: Cursor,
  from: Mapping
): AlertCondition | null {
  const metadata = readMetadata(at, from);
  if (metadata === null) return null;
  const here: Cursor = {
    where: `AlertCondition ${metadata.name}`,
    issues: at.issues,
  };
  const spec = readMapping(here, from, 'spec');
  if (spec === null) return null;
  const description = readOptionalString(here, spec, 'description');
  const severity = readString(here, spec, 'severity');
  const condition = readMapping(here, spec, 'condition');
  if (condition === null || severity === null) return null;
  const burn = readBurnRate(here, condition);
  if (burn === null) return null;
  return {
    name: metadata.name,
    displayName: metadata.displayName,
    description,
    severity,
    ...burn,
  };
}

type BurnRate = Pick<
  AlertCondition,
  'op' | 'threshold' | 'lookbackWindow' | 'alertAfter'
>;

function readBurnRate(at: Cursor, condition: Mapping): BurnRate | null {
  if (condition['kind'] !== 'burnrate') {
    return report(
      at,
      `condition.kind must be burnrate, got ${JSON.stringify(condition['kind']) ?? 'nothing'}`
    );
  }
  const op = readOneOf<Operator>(at, {
    from: condition,
    field: 'op',
    allowed: OPERATORS,
  });
  const threshold = condition['threshold'];
  const lookbackWindow = readDuration(at, condition, 'lookbackWindow');
  const alertAfter =
    condition['alertAfter'] === undefined
      ? null
      : readDuration(at, condition, 'alertAfter');
  if (
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  ) {
    report(
      at,
      `condition.threshold must be a positive number, got ${JSON.stringify(threshold) ?? 'nothing'}`
    );
    return null;
  }
  if (
    op === null ||
    lookbackWindow === null ||
    (condition['alertAfter'] !== undefined && alertAfter === null)
  ) {
    return null;
  }
  return { op, threshold, lookbackWindow, alertAfter };
}

export function readAlertNotificationTarget(
  at: Cursor,
  from: Mapping
): AlertNotificationTarget | null {
  const metadata = readMetadata(at, from);
  if (metadata === null) return null;
  const here: Cursor = {
    where: `AlertNotificationTarget ${metadata.name}`,
    issues: at.issues,
  };
  const spec = readMapping(here, from, 'spec');
  if (spec === null) return null;
  const description = readOptionalString(here, spec, 'description');
  const target = readString(here, spec, 'target');
  if (target === null) return null;
  return {
    name: metadata.name,
    displayName: metadata.displayName,
    description,
    target,
  };
}

/**
 * OpenSLO v1 lets an AlertPolicy name exactly one condition. A multi-window
 * policy (a long window to be sure, a short one to be sure it is still
 * happening) names its first condition there and the rest, comma-separated,
 * in this annotation; it fires only when all of them hold.
 */
export const AND_CONDITIONS_ANNOTATION = 'openslo-alerting/and-conditions';

/** The policy's further conditions, from its `metadata.annotations`. */
function readAndConditions(
  at: Cursor,
  from: Mapping
): readonly string[] | null {
  const metadata = from['metadata'];
  const annotations = isMapping(metadata) ? metadata['annotations'] : undefined;
  if (annotations === undefined) return [];
  if (!isMapping(annotations))
    return report(at, 'metadata.annotations must be a mapping');
  const value = annotations[AND_CONDITIONS_ANNOTATION];
  if (value === undefined) return [];
  if (typeof value !== 'string' || value.trim() === '')
    return report(
      at,
      `metadata.annotations.${AND_CONDITIONS_ANNOTATION} must name conditions, comma-separated`
    );
  return value.split(',').map((name) => name.trim());
}

export function readAlertPolicy(at: Cursor, from: Mapping): AlertPolicy | null {
  const metadata = readMetadata(at, from);
  if (metadata === null) return null;
  const here: Cursor = {
    where: `AlertPolicy ${metadata.name}`,
    issues: at.issues,
  };
  const spec = readMapping(here, from, 'spec');
  if (spec === null) return null;
  const description = readOptionalString(here, spec, 'description');
  const alertWhenNoData = readBoolean(here, spec, 'alertWhenNoData');
  const alertWhenResolved = readBoolean(here, spec, 'alertWhenResolved');
  const alertWhenBreaching = readBoolean(here, spec, 'alertWhenBreaching');
  const conditions = readRefs(here, {
    from: spec,
    field: 'conditions',
    refField: 'conditionRef',
  });
  const notificationTargets = readRefs(here, {
    from: spec,
    field: 'notificationTargets',
    refField: 'targetRef',
  });
  const labels = readLabels(here, from);
  const andConditions = readAndConditions(here, from);
  if (conditions !== null && conditions.length > 1) {
    report(
      here,
      `spec.conditions names ${String(conditions.length)} conditions; OpenSLO allows one, so name the rest in metadata.annotations.${AND_CONDITIONS_ANNOTATION}`
    );
    return null;
  }
  if (
    andConditions === null ||
    alertWhenNoData === null ||
    alertWhenResolved === null ||
    alertWhenBreaching === null ||
    conditions === null ||
    notificationTargets === null ||
    labels === null
  ) {
    return null;
  }
  return {
    name: metadata.name,
    displayName: metadata.displayName,
    description,
    alertWhenNoData,
    alertWhenResolved,
    alertWhenBreaching,
    conditions: [...conditions, ...andConditions],
    notificationTargets,
    labels,
  };
}

/** `field: [{ <refField>: name }, …]`, at least one, each a bare reference. */
export function readRefs(
  at: Cursor,
  input: {
    readonly from: Mapping;
    readonly field: string;
    readonly refField: string;
  }
): readonly string[] | null {
  const list = input.from[input.field];
  if (!Array.isArray(list) || list.length === 0) {
    return report(at, `${input.field} must be a non-empty list`);
  }
  const names: string[] = [];
  for (const [i, item] of list.entries()) {
    const ref: unknown = isMapping(item) ? item[input.refField] : undefined;
    if (typeof ref !== 'string' || ref.trim().length === 0) {
      return report(
        at,
        `${input.field}[${String(i)}] must be { ${input.refField}: <name> } (inline definitions are not read)`
      );
    }
    names.push(ref);
  }
  return names;
}

/** OpenSLO's label key: a DNS-label-like name, which allows no `/`. */
const LABEL_KEY = /^[a-zA-Z0-9]([-._a-zA-Z0-9]{0,61}[a-zA-Z0-9])?$/;

/** `metadata.labels`: each key maps to a string or a list of strings. */
export function readLabels(
  at: Cursor,
  from: Mapping
): Readonly<Record<string, readonly string[]>> | null {
  const metadata = from['metadata'];
  const labels = isMapping(metadata) ? metadata['labels'] : undefined;
  if (labels === undefined) return {};
  if (!isMapping(labels))
    return report(at, 'metadata.labels must be a mapping');
  const out: Record<string, readonly string[]> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (!LABEL_KEY.test(key)) {
      return report(
        at,
        `metadata.labels key "${key}" must be letters, digits, ".", "-" or "_", at most 63 (OpenSLO; no "/")`
      );
    }
    const values = Array.isArray(value) ? value : [value];
    if (!values.every((v): v is string => typeof v === 'string')) {
      return report(
        at,
        `metadata.labels.${key} must be text or a list of text`
      );
    }
    out[key] = values;
  }
  return out;
}
