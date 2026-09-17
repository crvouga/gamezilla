/** Shared chrome for the IdP's screens — a plain-HTML echo of Google's card. */

export function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: #fff; color: #202124;
    font-family: "Google Sans", Roboto, system-ui, -apple-system, sans-serif;
  }
  .card {
    width: 100%; max-width: 27rem; padding: 2.5rem 2.5rem 2rem;
    border: 1px solid #dadce0; border-radius: 1.75rem; margin: 1.5rem;
  }
  .brand { font-size: 1.375rem; letter-spacing: -0.5px; margin-bottom: 1rem; }
  .brand span:nth-child(1) { color: #4285f4; }
  .brand span:nth-child(2) { color: #ea4335; }
  .brand span:nth-child(3) { color: #fbbc05; }
  .brand span:nth-child(4) { color: #4285f4; }
  .brand span:nth-child(5) { color: #34a853; }
  .brand span:nth-child(6) { color: #ea4335; }
  h1 { font-size: 1.5rem; font-weight: 400; margin: 0 0 0.5rem; }
  p.sub { font-size: 1rem; color: #202124; margin: 0 0 1.5rem; }
  .account {
    display: flex; gap: 0.75rem; align-items: center; width: 100%;
    padding: 0.75rem 0.5rem; background: none; border: 0; cursor: pointer;
    text-align: left; font-size: 0.875rem; border-radius: 0.25rem;
  }
  .account:hover { background: #f8f9fa; }
  .avatar {
    width: 2rem; height: 2rem; border-radius: 50%; background: #1a73e8;
    color: #fff; display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem;
  }
  .account-name { font-weight: 500; }
  .account-email { color: #5f6368; }
  .divider { border-top: 1px solid #e8eaed; margin: 0.5rem 0; }
  label { display: block; font-size: 0.75rem; color: #5f6368; margin-bottom: 0.25rem; }
  input[type="text"], input[type="email"], input[type="password"] {
    width: 100%; padding: 0.875rem; font-size: 1rem; margin-bottom: 1.25rem;
    border: 1px solid #dadce0; border-radius: 0.25rem;
  }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
  button.primary {
    background: #1a73e8; color: #fff; border: 0; border-radius: 1.25rem;
    padding: 0.625rem 1.5rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;
  }
  button.text {
    background: none; color: #1a73e8; border: 0; border-radius: 1.25rem;
    padding: 0.625rem 1rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;
  }
  .scopes { margin: 0; padding-left: 1.25rem; font-size: 0.875rem; color: #5f6368; }
  .error { color: #d93025; font-size: 0.75rem; margin: -0.75rem 0 1rem; }
  .footer { margin-top: 2rem; font-size: 0.75rem; color: #5f6368; }
`;

export function idpPage(args: {
  readonly title: string;
  readonly testId: string;
  readonly body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(args.title)}</title>
  <style>${STYLES}</style>
</head>
<body data-testid="${escapeHtml(args.testId)}">
  <main class="card">
    <div class="brand" aria-label="Google"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div>
    ${args.body}
  </main>
</body>
</html>`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
