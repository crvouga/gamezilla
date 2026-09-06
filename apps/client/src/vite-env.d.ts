/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_COMMIT_HASH?: string;
  readonly VITE_COMMIT_DATE?: string;
  readonly VITE_E2E?: string;
  readonly VITE_ALLOW_PRODUCTION_API_URL?: string;
}
