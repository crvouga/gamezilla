/** Shared Jest transformIgnorePatterns that work with Bun's nested node_modules. */
function bunAwareTransformIgnorePatterns(extraAllow = []) {
  const allow = [
    '\\.bun/[^/]+/node_modules/',
    '(jest-)?react-native',
    '@react-native(-community)?',
    'expo(nent)?',
    '@expo(nent)?/.*',
    '@expo-google-fonts/.*',
    'react-navigation',
    '@react-navigation/.*',
    '@sentry/react-native',
    'native-base',
    'react-native-svg',
    '@testing-library/react-native',
    '@gorhom/.*',
    'lucide-react-native',
    'better-auth',
    '@better-auth/.*',
    'jose',
    'hono',
    'pg-mem',
    '@noble/.*',
    '@pkgs/',
    '@apps/',
    '@libs/',
    '@test/',
    ...extraAllow,
  ].join('|');
  return [`node_modules/(?!(${allow}))`];
}

module.exports = { bunAwareTransformIgnorePatterns };
