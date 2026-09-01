/**
 * esbuild alias target for `expo/devtools` inside the sql-host bundle.
 *
 * expo-sqlite's dev-tools client `require`s this lazily behind `__DEV__`, which
 * the bundle pins to `false`; the call is unreachable but still resolved.
 */

export function getDevToolsPluginClientAsync(): Promise<never> {
  return Promise.reject(
    new Error('expo devtools are not available in the sql-host bundle')
  );
}
