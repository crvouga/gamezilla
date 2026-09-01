import { IDP_PROVIDER_DEV } from '../shared/auth-constants';

export function devAuthorizePath(publicPathPrefix: string): string {
  const prefix = publicPathPrefix.replace(/\/$/, '');
  return `${prefix}/auth/dev/authorize`;
}

export function devAuthorizeCompletePath(publicPathPrefix: string): string {
  const prefix = publicPathPrefix.replace(/\/$/, '');
  return `${prefix}/auth/dev/authorize/complete`;
}

export function devCallbackPath(publicPathPrefix: string): string {
  const prefix = publicPathPrefix.replace(/\/$/, '');
  return `${prefix}/auth/callback/dev`;
}

export function buildDevAuthorizeUrl(args: {
  readonly baseURL: string;
  readonly publicPathPrefix: string;
  readonly state: string;
}): string {
  const origin = args.baseURL.replace(/\/$/, '');
  const path = devAuthorizePath(args.publicPathPrefix);
  const url = new URL(`${origin}${path}`);
  url.searchParams.set('state', args.state);
  return url.toString();
}

export function devRedirectUri(
  baseURL: string,
  publicPathPrefix: string
): string {
  const origin = baseURL.replace(/\/$/, '');
  return `${origin}${devCallbackPath(publicPathPrefix)}`;
}

export type DevAccountRow = {
  readonly provider_user_id: string;
  readonly name: string | null;
  readonly email: string | null;
};

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderDevAuthorizePage(args: {
  readonly state: string;
  readonly completePath: string;
  readonly accounts: readonly DevAccountRow[];
}): string {
  const accountButtons = args.accounts
    .map((row) => {
      const subject = escapeHtml(row.provider_user_id);
      const label = escapeHtml(row.name ?? row.provider_user_id);
      return `<button type="submit" name="subject" value="${subject}" data-testid="dev-idp-account-${subject}">${label}</button>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dev IdP</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 28rem; }
    h1 { font-size: 1.25rem; margin-bottom: 1rem; }
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    button { padding: 0.75rem 1rem; font-size: 1rem; cursor: pointer; }
    input { padding: 0.75rem; font-size: 1rem; }
    .new-account { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #ccc; }
  </style>
</head>
<body data-testid="dev-idp-page">
  <h1>Choose an account</h1>
  <form method="post" action="${escapeHtml(args.completePath)}">
    <input type="hidden" name="state" value="${escapeHtml(args.state)}" />
    ${accountButtons}
    <div class="new-account">
      <label for="subject">Or enter a subject</label>
      <input id="subject" name="subject" type="text" placeholder="alice" data-testid="dev-idp-subject-input" />
      <button type="submit" data-testid="dev-idp-continue">Continue</button>
    </div>
  </form>
</body>
</html>`;
}

export const DEV_PROVIDER = IDP_PROVIDER_DEV;
