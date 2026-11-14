/// <reference types="vite/client" />

/**
 * `VITE_API_URL`, `VITE_COMMIT_HASH` and `VITE_COMMIT_DATE` are written into a
 * bundle `vite` serves, and read where a built bundle runs (`vite.config.mts`):
 * the API is the page's own origin, and the commit is the one the deploy
 * stamped into the page, absent from a bundle nobody deployed.
 */
interface ImportMetaEnv {
  readonly VITE_FORCE_HOT_ASSERTS?: string;
}
