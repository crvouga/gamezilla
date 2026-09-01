/**
 * esbuild alias target for `react-native` inside the sql-host bundle.
 *
 * expo-sqlite's `SQLiteDatabase` only reads `Platform.OS`; pulling in the real
 * react-native-web graph would drag React into a worker-adjacent page bundle.
 */

export const Platform = {
  OS: 'web' as const,
  select: <T>(specifics: { web?: T; default?: T }): T | undefined =>
    specifics.web ?? specifics.default,
};

export default { Platform };
