/// <reference types="vite/client" />
/// <reference types="@pkgs/bun-test-solid-client-ts/jest-dom" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_COMMIT_HASH?: string;
  readonly VITE_COMMIT_DATE?: string;
  readonly VITE_TEST_HOOKS?: string;
  readonly VITE_ALLOW_PRODUCTION_API_URL?: string;
}
