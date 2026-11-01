/** Shared by the standalone launcher and the stack's Storybook process. */
export function storybookNetwork(env: Record<string, string | undefined>) {
  const host = env['STORYBOOK_HOST'] || '127.0.0.1';
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(host))
    throw new Error('STORYBOOK_HOST must be an IP address or hostname');
  const rawPort = env['STORYBOOK_PORT'] || '6006';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1024 || port > 65535)
    throw new Error('STORYBOOK_PORT must be an integer between 1024 and 65535');
  const origin = env['STORYBOOK_ORIGIN']
    ? new URL(env['STORYBOOK_ORIGIN'])
    : undefined;
  if (
    origin &&
    (!['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash)
  )
    throw new Error(
      'STORYBOOK_ORIGIN must be an HTTP(S) origin without credentials or a path'
    );
  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    ...(env['STORYBOOK_ALLOWED_HOSTS'] || '').split(',').filter(Boolean),
    ...(origin ? [origin.hostname] : []),
  ];
  for (const name of allowedHosts)
    if (!/^[a-zA-Z0-9.:[\]-]+$/.test(name) || name.startsWith('.'))
      throw new Error(
        'STORYBOOK_ALLOWED_HOSTS must list explicit hostnames separated by commas'
      );
  return { host, port, allowedHosts, origin: origin?.origin };
}
