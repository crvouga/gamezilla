/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FORCE_HOT_ASSERTS?: string;
  /** `1` in a bundle served with no servers behind it: every path opens the harness. */
  readonly VITE_HARNESS_ONLY?: string;
}
