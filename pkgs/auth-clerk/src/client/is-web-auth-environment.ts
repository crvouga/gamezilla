/** True in a browser document (Expo web). False on native / SSR. */
export function isWebAuthEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}
