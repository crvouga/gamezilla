/** Shared by the standalone launcher and the stack's Storybook process. */
export function storybookNetwork(env: Record<string, string | undefined>) {
  return network(env, 'STORYBOOK_PORT', '6006');
}

/** The test-owned server and its browser must target the same checkout. */
export function storybookTestNetwork(env: Record<string, string | undefined>) {
  return network(env, 'STORYBOOK_TEST_PORT', '6007');
}

function network(
  env: Record<string, string | undefined>,
  key: string,
  fallback: string
) {
  const rawPort = env[key] || fallback;
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1024 || port > 65535)
    throw new Error(`${key} must be an integer between 1024 and 65535`);
  return { host: '127.0.0.1', port };
}
