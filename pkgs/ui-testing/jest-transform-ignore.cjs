/**
 * Shared Jest `transformIgnorePatterns` for Bun + Expo.
 *
 * Bun nests packages at `node_modules/.bun/<pkg@ver>/node_modules/<pkg>/…`.
 * A naive `node_modules/(?!(pkg))` still matches the *inner* `node_modules/<pkg>`
 * and skips transform unless `<pkg>` is allowlisted.
 *
 * Pattern: after any `node_modules/`, optionally skip a `.bun/<pkg@ver>/node_modules/`
 * prefix, then require an allowlisted package name — so both classic and Bun
 * layouts share one allowlist (and we do not babel-transform the entire Bun store).
 */
function bunAwareTransformIgnorePatterns(extraAllow = []) {
  const allow = [
    '(jest-)?react-native',
    '@react-native(-community)?',
    'expo(nent)?',
    '@expo(nent)?/.*',
    '@expo-google-fonts/.*',
    'react-navigation',
    '@react-navigation/.*',
    'native-base',
    'react-native-svg',
    '@testing-library/react-native',
    '@gorhom/.*',
    'lucide-react-native',
    'better-auth',
    '@better-auth/.*',
    '@better-fetch/.*',
    'better-call',
    'kysely',
    'rou3',
    'nanostores',
    'defu',
    'zod',
    'jose',
    'hono',
    'pg-mem',
    '@crvouga/sqlite-mem',
    '@noble/.*',
    '@dicebear/.*',
    'mqtt',
    '@pkgs/',
    '@apps/',
    '@libs/',
    '@test/',
    ...extraAllow,
  ].join('|');
  // Prefix match (same as classic jest-expo): `expo(nent)?` covers `expo-modules-core`.
  // Optional `.bun/<pkg@ver>/node_modules/` so Bun nested layouts share the allowlist.
  return [
    `[/\\\\]node_modules[/\\\\](?!(?:\\.bun[/\\\\][^/]+[/\\\\]node_modules[/\\\\])?(?:${allow}))`,
  ];
}

module.exports = { bunAwareTransformIgnorePatterns };
