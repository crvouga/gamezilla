/**
 * Write an alert bundle as OpenSLO v1 documents: AlertNotificationTarget,
 * then AlertCondition, then AlertPolicy, in the bundle's order, so the same
 * bundle is always the same text and a committed copy can be compared.
 * `parseOpenSlo` reads the text back.
 */

import type { AlertBundle } from './alert-policy';

type Line = string;

const PLAIN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function scalar(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  return PLAIN.test(value) ? value : JSON.stringify(value);
}

function field(indent: number, key: string, value: string | number | boolean) {
  return `${' '.repeat(indent)}${key}: ${scalar(value)}`;
}

function header(
  kind: string,
  named: { readonly name: string; readonly displayName: string | null }
): Line[] {
  return [
    'apiVersion: openslo/v1',
    `kind: ${kind}`,
    'metadata:',
    field(2, 'name', named.name),
    ...(named.displayName === null
      ? []
      : [field(2, 'displayName', named.displayName)]),
  ];
}

function labels(values: Readonly<Record<string, readonly string[]>>): Line[] {
  const keys = Object.keys(values);
  if (keys.length === 0) return [];
  return [
    '  labels:',
    ...keys.flatMap((key) => [
      `    ${key}:`,
      ...(values[key] ?? []).map((v) => `      - ${scalar(v)}`),
    ]),
  ];
}

export function renderAlertDocuments(bundle: AlertBundle): string {
  const documents: Line[][] = [];
  for (const target of bundle.targets) {
    documents.push([
      ...header('AlertNotificationTarget', target),
      'spec:',
      ...(target.description === null
        ? []
        : [field(2, 'description', target.description)]),
      field(2, 'target', target.target),
    ]);
  }
  for (const c of bundle.conditions) {
    documents.push([
      ...header('AlertCondition', c),
      'spec:',
      ...(c.description === null
        ? []
        : [field(2, 'description', c.description)]),
      field(2, 'severity', c.severity),
      '  condition:',
      field(4, 'kind', 'burnrate'),
      field(4, 'op', c.op),
      field(4, 'threshold', c.threshold),
      field(4, 'lookbackWindow', c.lookbackWindow),
      ...(c.alertAfter === null ? [] : [field(4, 'alertAfter', c.alertAfter)]),
    ]);
  }
  for (const p of bundle.policies) {
    documents.push([
      ...header('AlertPolicy', p),
      ...labels(p.labels),
      'spec:',
      ...(p.description === null
        ? []
        : [field(2, 'description', p.description)]),
      field(2, 'alertWhenNoData', p.alertWhenNoData),
      field(2, 'alertWhenResolved', p.alertWhenResolved),
      field(2, 'alertWhenBreaching', p.alertWhenBreaching),
      '  conditions:',
      ...p.conditions.map((name) => `    - conditionRef: ${scalar(name)}`),
      '  notificationTargets:',
      ...p.notificationTargets.map(
        (name) => `    - targetRef: ${scalar(name)}`
      ),
    ]);
  }
  return `${documents.map((lines) => lines.join('\n')).join('\n---\n')}\n`;
}
