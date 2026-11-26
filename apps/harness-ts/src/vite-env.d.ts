/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FORCE_HOT_ASSERTS?: string;
  /** Where bug reports are sent (`https://api-dev.<domain>/api/bug-reports` on a Preview). */
  readonly VITE_BUG_REPORT_URL?: string;
  readonly VITE_COMMIT_HASH?: string;
}
