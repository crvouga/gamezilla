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
  /** The pull request's Storybook, a second site beside the Preview. */
  readonly storybookUrl: string | null;
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

/** The address without its scheme: what a link to it is called. */
function host(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function statusOf(facts: PreviewSectionFacts): string {
  return facts.status === 'failed' && facts.deployedSha === null
    ? '🔴 deploy failed — nothing has been deployed yet'
    : STATUS_LINE[facts.status];
}

/**
 * The one line a reader came for: the status and the links, before anything
 * else in the description.
 */
function leadLine(facts: PreviewSectionFacts): string {
  return [
    statusOf(facts),
    ...(facts.url === null ? [] : [`**[${host(facts.url)}](${facts.url})**`]),
    ...(facts.storybookUrl === null
      ? []
      : [`[Storybook](${facts.storybookUrl})`]),
  ].join(' · ');
}

function howToUse(facts: PreviewSectionFacts): readonly string[] {
  return [
    '',
    '**What this is:** the whole system — API servers, Postgres, rooms, and simulated identity, billing, storage and LLM vendors — running inside your browser tab. The URL serves static files only: no server, no secrets, no production data. It shows one app at a time: tap the floating button for the next person, hold it for everything else.',
    ...(facts.storybookUrl === null
      ? []
      : [
          '',
          "**Storybook:** this pull request's build of the component library, at the same commit.",
        ]),
    '',
    '**Sign in:** nothing to sign in to. The system starts with two people, `alice` and `bob`, each signed in on a device of their own and already friends; tap the floating button to go from one to the other.',
    '',
    '**Reset:** state lives only in your browser, under this URL. Clear the site data for it (or open it in a fresh browser profile) to start clean; nothing is stored anywhere else.',
    '',
    `**Diagnostics:** \`PREVIEW_PR=${String(facts.pr)} mise run preview:test\` checks what is deployed; node logs are in the menu the floating button opens (docs/PREVIEW_ENVIRONMENTS.md).`,
  ];
}

/**
 * The section: the status and the links on its first line, a failure's
 * reason under it, and everything else (commits, the deploy run, how to use
 * a Preview) folded away so it never pushes the description down.
 */
export function renderPreviewSection(facts: PreviewSectionFacts): string {
  const rows = [
    `| Status | ${statusOf(facts)} |`,
    `| URL | ${facts.url ?? '—'} |`,
    ...(facts.storybookUrl === null
      ? []
      : [`| Storybook | ${facts.storybookUrl} |`]),
    `| Deployed commit | ${short(facts.deployedSha)} |`,
  ];
  if (facts.attemptedSha !== null && facts.attemptedSha !== facts.deployedSha)
    rows.push(`| Attempted commit | ${short(facts.attemptedSha)} |`);
  if (facts.runUrl !== null) rows.push(`| Deploy run | ${facts.runUrl} |`);
  const live = facts.status !== 'removed' && facts.status !== 'expired';
  return [
    PREVIEW_SECTION_START,
    '## Preview',
    '',
    leadLine(facts),
    ...(facts.detail === null ? [] : ['', `> ${facts.detail}`]),
    '',
    '<details><summary>Commits, the deploy run and how to use it</summary>',
    '',
    '| | |',
    '| --- | --- |',
    ...rows,
    ...(live ? howToUse(facts) : []),
    '',
    '</details>',
    PREVIEW_SECTION_END,
  ].join('\n');
}

/**
 * The description with the section at its very top, where the link is one
 * glance away: put there when it is missing, moved there when it was
 * elsewhere, replaced in place when it is there already. The author's text
 * follows it, as written.
 */
export function upsertPreviewSection(body: string, section: string): string {
  const start = body.indexOf(PREVIEW_SECTION_START);
  const end = body.indexOf(PREVIEW_SECTION_END, Math.max(start, 0));
  const found = start !== -1 && end !== -1;
  const before = found ? body.slice(0, start) : body;
  const after = found ? body.slice(end + PREVIEW_SECTION_END.length) : '';
  if (found && before.trim() === '') return `${section}${after}`;
  const authored = `${before.replace(/\s+$/, '')}${after}`.replace(/^\s+/, '');
  return authored === '' ? section : `${section}\n\n${authored}`;
}

function urlInBody(body: string, row: 'URL' | 'Storybook'): string | null {
  const start = body.indexOf(PREVIEW_SECTION_START);
  const end = body.indexOf(PREVIEW_SECTION_END, Math.max(start, 0));
  if (start === -1 || end === -1) return null;
  const match = new RegExp(`\\| ${row} \\| (https://[^\\s|]+) \\|`).exec(
    body.slice(start, end)
  );
  return match?.[1] ?? null;
}

/** The Preview URL in a description — how an agent finds it from PR metadata. */
export function previewUrlInBody(body: string): string | null {
  return urlInBody(body, 'URL');
}

/** The Storybook URL in a description, when the section names one. */
export function storybookUrlInBody(body: string): string | null {
  return urlInBody(body, 'Storybook');
}
