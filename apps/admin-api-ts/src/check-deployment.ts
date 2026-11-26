type Probe = (url: string) => Promise<{
  readonly status?: number;
  readonly body?: string;
}>;

/** Check the public edge from a fresh, signed-out request, including the SPA's actual entry module. */
export async function checkAdminDeployment(
  origin: string,
  probe: Probe
): Promise<void> {
  const shell = await probe(`${origin}/`);
  const html = shell.body ?? '';
  if (
    shell.status !== 200 ||
    !/<title>[^<]+ Administration<\/title>/.test(html)
  )
    throw new Error(
      `${origin}/ did not serve the administration client (HTTP ${String(shell.status)})`
    );
  const entry = /<script\b[^>]*\bsrc="(\/assets\/[\w.-]+\.js)"/.exec(html)?.[1];
  if (!entry) throw new Error(`${origin}/ has no built client entry module`);

  const [bundle, access] = await Promise.all([
    probe(`${origin}${entry}`),
    probe(`${origin}/api/admin/access`),
  ]);
  if (bundle.status !== 200 || !bundle.body?.startsWith('/*! Origin: '))
    throw new Error(
      `${origin}${entry} did not serve the built JavaScript module (HTTP ${String(bundle.status)})`
    );
  if (
    access.status !== 401 ||
    access.body !== JSON.stringify({ error: 'Sign in to open administration.' })
  )
    throw new Error(
      `${origin}/api/admin/access did not return the signed-out administration response (HTTP ${String(access.status)})`
    );
}
