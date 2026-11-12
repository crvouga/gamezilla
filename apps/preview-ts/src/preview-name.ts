/**
 * One pull request owns one named Cloudflare Worker Preview: `pr-<number>`.
 * The name is the whole isolation boundary — Cloudflare gives each named
 * Preview its own Durable Object namespaces and storage — so every command
 * derives it the same way.
 */

const PREVIEW_NAME = /^pr-([1-9][0-9]*)$/;

export function previewNameOfPr(pr: number): string {
  if (!Number.isSafeInteger(pr) || pr <= 0)
    throw new Error(`not a pull request number: ${String(pr)}`);
  return `pr-${String(pr)}`;
}

/** The pull request a Preview belongs to, or `null` for a name we never made. */
export function prOfPreviewName(name: string): number | null {
  const match = PREVIEW_NAME.exec(name);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** What the main branch's deployment calls itself in `preview.json`. */
export const MAIN_PREVIEW_NAME = 'main';

/**
 * `https://<preview>.<host>`: a Preview on the custom domain, where `host`
 * (`preview.example.com`) itself serves the main branch.
 */
export function customPreviewOrigin(args: {
  readonly previewName: string;
  readonly host: string;
}): string {
  return `https://${args.previewName}.${args.host}`;
}

/** `https://<preview>-<worker>.<account subdomain>.workers.dev` */
export function previewOrigin(args: {
  readonly previewName: string;
  readonly workerName: string;
  readonly subdomain: string;
}): string {
  const label = `${args.previewName}-${args.workerName}`;
  // A DNS label holds 63 characters; Cloudflare would truncate a longer one
  // and the client bundle would then point at a host that does not exist.
  if (label.length > 63)
    throw new Error(`preview host label is over 63 characters: ${label}`);
  return `https://${label}.${args.subdomain}.workers.dev`;
}

/**
 * Whether `origin` is this pull request's Preview on our own account or our
 * own custom domain (`host`, when there is one). A pull request description
 * is editable by its author, so a URL read from one is only sent the admin
 * token after this says the host is ours.
 */
export function isPreviewOriginOf(args: {
  readonly origin: string;
  readonly previewName: string;
  readonly subdomain: string;
  readonly host?: string | null;
}): boolean {
  let url: URL;
  try {
    url = new URL(args.origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '') return false;
  if (
    args.host !== undefined &&
    args.host !== null &&
    url.hostname === `${args.previewName}.${args.host}`
  )
    return true;
  const suffix = `.${args.subdomain}.workers.dev`;
  if (!url.hostname.endsWith(suffix)) return false;
  const label = url.hostname.slice(0, -suffix.length);
  return /^[a-z0-9-]+$/.test(label) && label.startsWith(`${args.previewName}-`);
}
