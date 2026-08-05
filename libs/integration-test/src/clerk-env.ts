function readFirstEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim() ?? '';
    if (value.length > 0) return value;
  }
  return '';
}

/**
 * `@clerk/testing` reads `CLERK_*` env vars. Product secrets use neutral
 * `AUTH_*` names — mirror them before `clerkSetup()` / programmatic sign-in.
 */
export function applyClerkPlaywrightEnv(): void {
  const publishableKey = readFirstEnv([
    'CLERK_PUBLISHABLE_KEY',
    'AUTH_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  ]);
  const secretKey = readFirstEnv(['CLERK_SECRET_KEY', 'AUTH_SECRET_KEY']);

  if (publishableKey.length > 0) {
    process.env['CLERK_PUBLISHABLE_KEY'] = publishableKey;
  }
  if (secretKey.length > 0) {
    process.env['CLERK_SECRET_KEY'] = secretKey;
  }
}
