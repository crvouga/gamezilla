/** Object-store key layout for one report bucket. */

export const RUNS_INDEX_KEY = 'runs/index.json';
export const GENERATION_KEY = 'runs/generation';

export function runPrefix(runId: string): string {
  return `runs/${runId}`;
}

export function runManifestKey(runId: string): string {
  return `${runPrefix(runId)}/manifest.json`;
}

export function testReportKey(runId: string, testId: string): string {
  return `${runPrefix(runId)}/tests/${testId}/report.json`;
}

export function testFrameKey(
  runId: string,
  testId: string,
  frameFile: string
): string {
  const rel = frameFile.replace(/^\/+/, '');
  return `${runPrefix(runId)}/tests/${testId}/${rel}`;
}

export function mediaExtension(media: string): string {
  switch (media) {
    case 'html':
      return 'html';
    case 'png':
      return 'png';
    case 'json':
      return 'json';
    case 'text':
      return 'txt';
    case 'bytes':
      return 'bin';
    default:
      return 'bin';
  }
}

export function contentTypeForMedia(media: string): string {
  switch (media) {
    case 'html':
      return 'text/html; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'text':
      return 'text/plain; charset=utf-8';
    case 'bytes':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}
