/** Build-time conformance probes; absent in end-user bundles. */
const env = import.meta.env as { VITE_TEST_HOOKS?: string; NODE_ENV?: string };
export const TEST_HOOKS_ENABLED =
  env.VITE_TEST_HOOKS === '1' || env.NODE_ENV === 'test';
