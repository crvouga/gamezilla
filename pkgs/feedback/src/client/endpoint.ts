/** Root reporting must initialize even when optional platform configuration is bad. */
export function feedbackEndpoint(base: string): string {
  try {
    return new URL('/api/feedback', base).href;
  } catch {
    return '/api/feedback';
  }
}
