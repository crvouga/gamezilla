/**
 * The Preview section of a pull request description: one marker-delimited
 * block this tooling owns. Everything outside the markers is the author's and
 * is returned byte for byte.
 */

export const PREVIEW_SECTION_START = '<!-- preview:start -->';
export const PREVIEW_SECTION_END = '<!-- preview:end -->';

export type PreviewSectionFacts = {
  readonly pr: number;
  readonly status:
    | 'deploying'
    | 'live'
    | 'failed'
    | 'unhealthy'
    | 'removed'
    | 'expired';
  readonly url: string | null;
  /** The commit the Preview is serving, when one is. */
  readonly deployedSha: string | null;
  /** The commit this run tried to deploy. */
  readonly attemptedSha: string | null;
  readonly runUrl: string | null;
  readonly detail: string | null;
};

const STATUS_LINE: Record<PreviewSectionFacts['status'], string> = {
  deploying: '🟡 deploying',
  live: '🟢 live',
  failed: '🔴 deploy failed — the last working version is still serving',
  unhealthy: '🔴 deployed, but failing its checks',
  removed: '⚪ removed (pull request closed)',
  expired: '⚪ removed after going unused — push a commit or reopen to restore',
};

function short(sha: string | null): string {
  return sha === null ? '—' : `\`${sha.slice(0, 12)}\``;
}

export function renderPreviewSection(facts: PreviewSectionFacts): string {
  const pr = String(facts.pr);
  const rows = [
    `| Status | ${STATUS_LINE[facts.status]} |`,
    `| URL | ${facts.url ?? '—'} |`,
    `| Deployed commit | ${short(facts.deployedSha)} |`,
  ];
  if (facts.attemptedSha !== null && facts.attemptedSha !== facts.deployedSha)
    rows.push(`| Attempted commit | ${short(facts.attemptedSha)} |`);
  if (facts.runUrl !== null) rows.push(`| Deploy run | ${facts.runUrl} |`);
  const lines = [
    PREVIEW_SECTION_START,
    '## Preview',
    '',
    '| | |',
    '| --- | --- |',
    ...rows,
  ];
  if (facts.detail !== null) lines.push('', `> ${facts.detail}`);
  if (facts.status !== 'removed' && facts.status !== 'expired')
    lines.push(
      '',
      '**What this is:** the whole system — API servers, Postgres, rooms, and simulated identity, billing, storage and LLM vendors — running inside your browser tab. The URL serves static files only: no server, no secrets, no production data. Each panel of the console looks into one node.',
      '',
      '**Sign in:** nothing to sign in to. The harness starts its own client actors with simulated identities; drive them from the console.',
      '',
      '**Reset:** state lives only in your browser, under this URL. Clear the site data for it (or open it in a fresh browser profile) to start clean; nothing is stored anywhere else.',
      '',
      `**Diagnostics:** \`PREVIEW_PR=${pr} mise run preview:test\` checks what is deployed; node logs are in the console panels (docs/PREVIEW_ENVIRONMENTS.md).`
    );
  lines.push(PREVIEW_SECTION_END);
  return lines.join('\n');
}

/** Replace the section in place, or append it; the rest is untouched. */
export function upsertPreviewSection(body: string, section: string): string {
  const start = body.indexOf(PREVIEW_SECTION_START);
  const end = body.indexOf(PREVIEW_SECTION_END, Math.max(start, 0));
  if (start === -1 || end === -1) {
    if (body.trim() === '') return section;
    return `${body.replace(/\s+$/, '')}\n\n${section}`;
  }
  return (
    body.slice(0, start) +
    section +
    body.slice(end + PREVIEW_SECTION_END.length)
  );
}

/** The Preview URL in a description — how an agent finds it from PR metadata. */
export function previewUrlInBody(body: string): string | null {
  const start = body.indexOf(PREVIEW_SECTION_START);
  const end = body.indexOf(PREVIEW_SECTION_END, Math.max(start, 0));
  if (start === -1 || end === -1) return null;
  const match = /\| URL \| (https:\/\/[^\s|]+) \|/.exec(body.slice(start, end));
  return match?.[1] ?? null;
}
