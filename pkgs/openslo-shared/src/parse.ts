/**
 * Read an OpenSLO v1 file (one or more YAML documents) into its SLIs and
 * SLOs, or every issue that keeps it from being a well-formed objective:
 * a document that is not `openslo/v1`, a kind other than `SLI`/`SLO`, a
 * missing or mistyped field, a bad duration, a target out of range, a
 * duplicate name, an `indicatorRef` that names no SLI in the file, or an
 * objective whose `op`/`value` do not fit its indicator.
 */

import type { OpenSloDoc, Sli, Slo } from './model';
import type { Cursor, Mapping } from './parse-fields';
import { isMapping, report } from './parse-fields';
import { readSli } from './parse-sli';
import { readSlo } from './parse-slo';

export type ParseResult =
  | { readonly ok: true; readonly doc: OpenSloDoc }
  | { readonly ok: false; readonly issues: readonly string[] };

export const API_VERSION = 'openslo/v1';
export const SUPPORTED_KINDS: readonly string[] = ['SLI', 'SLO'];

export function parseOpenSlo(text: string): ParseResult {
  const documents = readDocuments(text);
  if (!documents.ok) return documents;
  const issues: string[] = [];
  const slis: Sli[] = [];
  const slos: Slo[] = [];
  for (const [i, document] of documents.list.entries()) {
    readDocument({ where: `document ${String(i + 1)}`, issues }, document, {
      slis,
      slos,
    });
  }
  if (slis.length + slos.length === 0 && issues.length === 0) {
    issues.push('the file declares no SLI or SLO');
  }
  checkUniqueNames(issues, 'SLI', slis);
  checkUniqueNames(issues, 'SLO', slos);
  for (const slo of slos) checkIndicatorUse(issues, slo, slis);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, doc: { slis, slos } };
}

/** Multi-document YAML parses to a list; so does a top-level list of documents. */
function readDocuments(
  text: string
):
  | { readonly ok: true; readonly list: readonly unknown[] }
  | { readonly ok: false; readonly issues: readonly string[] } {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, issues: [`not YAML: ${message}`] };
  }
  const list = (Array.isArray(parsed) ? parsed : [parsed])
    .flatMap((document: unknown) =>
      Array.isArray(document) ? document : [document]
    )
    .filter((document) => document !== null && document !== undefined);
  return { ok: true, list };
}

function readDocument(
  at: Cursor,
  document: unknown,
  into: { readonly slis: Sli[]; readonly slos: Slo[] }
): void {
  if (!isMapping(document)) {
    report(at, 'must be a mapping with apiVersion, kind, metadata and spec');
    return;
  }
  if (document['apiVersion'] !== API_VERSION) {
    report(
      at,
      `apiVersion must be ${API_VERSION}, got ${JSON.stringify(document['apiVersion']) ?? 'nothing'}`
    );
    return;
  }
  const kind = document['kind'];
  if (typeof kind !== 'string' || !SUPPORTED_KINDS.includes(kind)) {
    report(
      at,
      `kind ${JSON.stringify(kind) ?? 'nothing'} is not supported (${SUPPORTED_KINDS.join(', ')})`
    );
    return;
  }
  readKind(at, kind, document, into);
}

function readKind(
  at: Cursor,
  kind: string,
  document: Mapping,
  into: { readonly slis: Sli[]; readonly slos: Slo[] }
): void {
  const here: Cursor = { where: `${at.where} (${kind})`, issues: at.issues };
  if (kind === 'SLI') {
    const sli = readSli(here, { from: document, inline: false });
    if (sli !== null) into.slis.push(sli);
    return;
  }
  const read = readSlo(here, document);
  if (read === null) return;
  into.slos.push(read.slo);
  if (read.inlineSli !== null) into.slis.push(read.inlineSli);
}

function checkUniqueNames(
  issues: string[],
  kind: string,
  items: readonly { readonly name: string }[]
): void {
  const seen = new Set<string>();
  for (const { name } of items) {
    if (seen.has(name)) issues.push(`${kind} ${name} is declared twice`);
    seen.add(name);
  }
}

function checkIndicatorUse(
  issues: string[],
  slo: Slo,
  slis: readonly Sli[]
): void {
  const sli = slis.find((candidate) => candidate.name === slo.indicator);
  if (sli === undefined) {
    issues.push(
      `SLO ${slo.name}: indicatorRef "${slo.indicator}" names no SLI in this file`
    );
    return;
  }
  const threshold = sli.metric.kind === 'threshold';
  for (const objective of slo.objectives) {
    const where = `SLO ${slo.name} objective "${objective.displayName}"`;
    const hasCompare = objective.op !== null || objective.value !== null;
    if (threshold && (objective.op === null || objective.value === null)) {
      issues.push(
        `${where}: threshold SLI ${sli.name} needs op and value on every objective`
      );
    }
    if (!threshold && hasCompare) {
      issues.push(`${where}: ratio SLI ${sli.name} takes no op or value`);
    }
  }
}
