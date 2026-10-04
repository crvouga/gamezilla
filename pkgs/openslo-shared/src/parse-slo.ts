/**
 * An SLO document: the service, the indicator (by `indicatorRef` or inline),
 * one time window, the budgeting method and the objectives. Whether each
 * objective fits its indicator (`op`/`value` for thresholds only) is checked
 * once every SLI is known, in `parse`.
 */

import type {
  BudgetingMethod,
  Objective,
  Operator,
  Sli,
  Slo,
  TimeWindow,
} from './model';
import { BUDGETING_METHODS, OPERATORS } from './model';
import type { Cursor, Mapping } from './parse-fields';
import {
  isMapping,
  readBoolean,
  readFraction,
  readMapping,
  readMetadata,
  readOneOf,
  readOptionalString,
  readString,
  report,
} from './parse-fields';
import { readSli } from './parse-sli';
import { parseDuration, parseStartTime, UTC_ZONES } from './window';

export type ReadSlo = { readonly slo: Slo; readonly inlineSli: Sli | null };

export function readSlo(at: Cursor, from: Mapping): ReadSlo | null {
  const metadata = readMetadata(at, from);
  if (metadata === null) return null;
  const here: Cursor = { where: `SLO ${metadata.name}`, issues: at.issues };
  const spec = readMapping(here, from, 'spec');
  if (spec === null) return null;
  const description = readOptionalString(here, spec, 'description');
  const service = readString(here, spec, 'service');
  const indicator = readIndicator(here, spec);
  const timeWindow = readTimeWindow(here, spec);
  const budgetingMethod = readOneOf(here, {
    from: spec,
    field: 'budgetingMethod',
    allowed: BUDGETING_METHODS,
  });
  const objectives =
    budgetingMethod === null
      ? null
      : readObjectives(here, spec, budgetingMethod);
  if (
    service === null ||
    indicator === null ||
    timeWindow === null ||
    budgetingMethod === null ||
    objectives === null
  ) {
    return null;
  }
  return {
    slo: {
      name: metadata.name,
      displayName: metadata.displayName,
      description,
      service,
      indicator: indicator.name,
      timeWindow,
      budgetingMethod,
      objectives,
    },
    inlineSli: indicator.inline,
  };
}

function readIndicator(
  at: Cursor,
  spec: Mapping
): { readonly name: string; readonly inline: Sli | null } | null {
  const hasRef = spec['indicatorRef'] !== undefined;
  const hasInline = spec['indicator'] !== undefined;
  if (hasRef === hasInline) {
    return report(at, 'spec needs exactly one of indicatorRef and indicator');
  }
  if (hasRef) {
    const name = readString(at, spec, 'indicatorRef');
    return name === null ? null : { name, inline: null };
  }
  const inline = readMapping(at, spec, 'indicator');
  if (inline === null) return null;
  const sli = readSli(at, { from: inline, inline: true });
  return sli === null ? null : { name: sli.name, inline: sli };
}

function readTimeWindow(at: Cursor, spec: Mapping): TimeWindow | null {
  const windows = spec['timeWindow'];
  if (!Array.isArray(windows) || windows.length !== 1) {
    return report(at, 'timeWindow must be a list of exactly one window');
  }
  const window: unknown = windows[0];
  if (!isMapping(window)) return report(at, 'timeWindow[0] must be a mapping');
  const here: Cursor = {
    where: `${at.where} timeWindow[0]`,
    issues: at.issues,
  };
  const duration = readDuration(here, window, 'duration');
  const isRolling = readBoolean(here, window, 'isRolling');
  if (duration === null || isRolling === null) return null;
  if (isRolling) {
    if (window['calendar'] !== undefined) {
      return report(here, 'a rolling window has no calendar');
    }
    return { duration, isRolling, calendar: null };
  }
  const calendar = readMapping(here, window, 'calendar');
  if (calendar === null) return null;
  const startTime = readString(here, calendar, 'startTime');
  const timeZone = readString(here, calendar, 'timeZone');
  if (startTime === null || timeZone === null) return null;
  if (parseStartTime(startTime) === null) {
    return report(
      here,
      `calendar.startTime "${startTime}" must be YYYY-MM-DD HH:MM:SS`
    );
  }
  if (!UTC_ZONES.includes(timeZone)) {
    return report(
      here,
      `calendar.timeZone ${timeZone} is not supported (only UTC)`
    );
  }
  return { duration, isRolling, calendar: { startTime, timeZone } };
}

function readDuration(at: Cursor, from: Mapping, field: string): string | null {
  const text = readString(at, from, field);
  if (text === null) return null;
  if (parseDuration(text) === null) {
    return report(
      at,
      `${field} "${text}" must be a positive whole number of s, m, h, d or w (28d)`
    );
  }
  return text;
}

function readObjectives(
  at: Cursor,
  spec: Mapping,
  method: BudgetingMethod
): readonly Objective[] | null {
  const list = spec['objectives'];
  if (!Array.isArray(list) || list.length === 0) {
    return report(at, 'objectives must be a non-empty list');
  }
  const read = list.map((item: unknown, i) =>
    readObjective(
      { where: `${at.where} objectives[${String(i)}]`, issues: at.issues },
      item,
      method
    )
  );
  const objectives = read.filter((o): o is Objective => o !== null);
  const names = objectives.map((o) => o.displayName);
  for (const [i, name] of names.entries()) {
    if (names.indexOf(name) !== i) {
      report(at, `objective "${name}" is declared twice`);
    }
  }
  return objectives.length === list.length ? objectives : null;
}

function readObjective(
  at: Cursor,
  item: unknown,
  method: BudgetingMethod
): Objective | null {
  if (!isMapping(item)) return report(at, 'must be a mapping');
  const displayName = readString(at, item, 'displayName');
  const target = readTarget(at, item);
  const op =
    item['op'] === undefined
      ? null
      : readOneOf<Operator>(at, {
          from: item,
          field: 'op',
          allowed: OPERATORS,
        });
  const value = readValue(at, item);
  const slices = readTimeSlices(at, item, method);
  if (displayName === null || target === null || slices === null) return null;
  if ((item['op'] !== undefined && op === null) || value === undefined) {
    return null;
  }
  return { displayName, target, op, value, ...slices };
}

function readTarget(at: Cursor, item: Mapping): number | null {
  const hasTarget = item['target'] !== undefined;
  const hasPercent = item['targetPercent'] !== undefined;
  if (hasTarget === hasPercent) {
    return report(at, 'needs exactly one of target and targetPercent');
  }
  if (hasTarget)
    return readFraction(at, { from: item, field: 'target', max: 1 });
  const percent = readFraction(at, {
    from: item,
    field: 'targetPercent',
    max: 100,
  });
  return percent === null ? null : percent / 100;
}

/** `null` when absent; `undefined` when present but not a finite number. */
function readValue(at: Cursor, item: Mapping): number | null | undefined {
  const value = item['value'];
  if (value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  report(at, `value must be a finite number, got ${JSON.stringify(value)}`);
  return undefined;
}

function readTimeSlices(
  at: Cursor,
  item: Mapping,
  method: BudgetingMethod
): Pick<Objective, 'timeSliceTarget' | 'timeSliceWindow'> | null {
  if (method === 'Occurrences') {
    for (const field of ['timeSliceTarget', 'timeSliceWindow']) {
      if (item[field] !== undefined) {
        return report(
          at,
          `${field} applies only to budgetingMethod Timeslices`
        );
      }
    }
    return { timeSliceTarget: null, timeSliceWindow: null };
  }
  const timeSliceTarget = readFraction(at, {
    from: item,
    field: 'timeSliceTarget',
    max: 1,
  });
  const timeSliceWindow = readDuration(at, item, 'timeSliceWindow');
  if (timeSliceTarget === null || timeSliceWindow === null) return null;
  return { timeSliceTarget, timeSliceWindow };
}
