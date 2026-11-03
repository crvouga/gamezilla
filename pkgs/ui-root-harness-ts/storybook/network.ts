/** Shared by the standalone launcher and the stack's Storybook process. */
export function storybookNetwork(env: Record<string, string | undefined>) {
  const rawPort = env['STORYBOOK_PORT'] || '6006';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1024 || port > 65535)
    throw new Error('STORYBOOK_PORT must be an integer between 1024 and 65535');
  return { host: '127.0.0.1', port };
}
