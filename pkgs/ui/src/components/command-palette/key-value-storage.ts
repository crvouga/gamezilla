/**
 * Duck-typed async key/value storage adapter used by the command palette
 * MRU history store. Matches `AsyncStorage` / `localStorage`-style
 * `getItem` / `setItem` so callers can pass any of the common React Native
 * persistence implementations without coupling to a specific package.
 *
 * Follow-up: migrate the history store to `@pkgs/kv` + `useKvState` and
 * delete this type. Kept local to the command-palette folder so the theme
 * module can drop the legacy `ThemePreferenceStorage` re-export cleanly.
 */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
