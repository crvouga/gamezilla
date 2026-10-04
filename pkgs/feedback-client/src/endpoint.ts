/** Feedback remains reachable when optional host configuration is malformed. */
export function feedbackEndpoint(base: string, path = '/api/feedback'): string {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}
