/** Root reporting must initialize even when optional platform configuration is bad. */
export function bugReportEndpoint(base: string): string {
  try {
    return new URL('/api/bug-reports', base).href;
  } catch {
    return '/api/bug-reports';
  }
}
