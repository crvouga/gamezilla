/**
 * Self-service readiness gate (`@libs/tools-harness-ts#ci:goals`).
 *
 * `docs/SELF_SERVICE_READINESS.md` is the product-quality standard and its
 * readiness matrix. A matrix is only worth keeping while it describes the
 * repository: every path it cites exists, every critical journey has a row,
 * every bug id it names is registered, and the agent briefing points at it.
 * Product copy never sends a person to a support desk the product does not
 * have.
 */

export const READINESS_DOC = 'docs/SELF_SERVICE_READINESS.md';
export const CRITICAL_JOURNEYS = 'specs/journeys/critical-journeys.feature';
export const AGENT_BRIEFING = 'AGENTS.md';
export const PRODUCT_CATALOG = 'libs/app-root-shared-ts/locales/en/messages.po';

/** Copy that makes a person depend on a staffed support channel. */
const SUPPORT_DEPENDENCY =
  /contact (?:our )?(?:support|us|the team)|email us|support@|help ?desk|open a ticket/i;

/** A repo-relative file or directory cited in the matrix. */
const CITED_PATH =
  /^(?:apps|libs|pkgs|specs|docs|\.github)\/[\w./-]*[\w/]$|^[A-Z_]+\.md$/;

/** A known-bug id: lower-kebab-case with at least one hyphen. */
const BUG_ID = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

export type ReadinessInputs = {
  /** Reads a repo-relative path; `null` when it is missing. */
  readonly read: (path: string) => string | null;
  /** Whether a repo-relative file or directory exists. */
  readonly exists: (path: string) => boolean;
  readonly knownBugIds: ReadonlySet<string>;
};

/** The matrix: every table row below `## Readiness matrix`, up to the next `## `. */
export function matrixRows(doc: string): readonly string[] {
  const start = doc.indexOf('\n## Readiness matrix');
  if (start < 0) return [];
  const rest = doc.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  const section = end < 0 ? rest : rest.slice(0, end);
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .filter((line) => !line.startsWith('| Journey |'));
}

function codeSpans(line: string): readonly string[] {
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');
}

export function scenarioTitles(feature: string): readonly string[] {
  return [...feature.matchAll(/^\s*Scenario(?: Outline)?:\s*(.+?)\s*$/gm)].map(
    (match) => match[1] ?? ''
  );
}

function supportDependencies(catalog: string): readonly string[] {
  return catalog
    .split('\n')
    .filter((line) => /^msg(?:id|str) /.test(line))
    .filter((line) => SUPPORT_DEPENDENCY.test(line));
}

function citationErrors(
  rows: readonly string[],
  inputs: ReadinessInputs
): readonly string[] {
  return rows.flatMap(codeSpans).flatMap((span) => {
    if (CITED_PATH.test(span) && !inputs.exists(span)) {
      return [`${READINESS_DOC} cites a missing path: ${span}`];
    }
    if (BUG_ID.test(span) && !inputs.knownBugIds.has(span)) {
      return [`${READINESS_DOC} names an unregistered bug: ${span}`];
    }
    return [];
  });
}

function journeyErrors(
  rows: readonly string[],
  inputs: ReadinessInputs
): readonly string[] {
  const matrix = rows.join('\n');
  return scenarioTitles(inputs.read(CRITICAL_JOURNEYS) ?? '')
    .filter((title) => !matrix.includes(`"${title}"`))
    .map((title) => `${READINESS_DOC} has no row for the journey "${title}"`);
}

export function validateReadiness(inputs: ReadinessInputs): readonly string[] {
  const doc = inputs.read(READINESS_DOC);
  if (doc === null) return [`${READINESS_DOC} is missing`];
  const rows = matrixRows(doc);
  const briefing = inputs.read(AGENT_BRIEFING) ?? '';
  return [
    ...(rows.length === 0 ? [`${READINESS_DOC} has no matrix rows`] : []),
    ...citationErrors(rows, inputs),
    ...journeyErrors(rows, inputs),
    ...(briefing.includes(READINESS_DOC)
      ? []
      : [`${AGENT_BRIEFING} does not link ${READINESS_DOC}`]),
    ...supportDependencies(inputs.read(PRODUCT_CATALOG) ?? '').map(
      (line) => `product copy depends on a support desk: ${line}`
    ),
  ];
}
