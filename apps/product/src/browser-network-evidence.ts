/** Sanitized transport evidence: no request bodies, query strings or credentials. */
export function browserNetworkEvidence(view: Bun.WebView): string[] {
  const lines: string[] = [];
  const requests = new Map<string, string>();
  const record = (entry: unknown): void => {
    lines.push(JSON.stringify(entry));
    if (lines.length > 200) lines.shift();
  };
  view.addEventListener<{ requestId: string; request: { url: string } }>(
    'Network.requestWillBeSent',
    ({ data }) => {
      const url = new URL(data.request.url);
      if (!url.pathname.startsWith('/api/')) return;
      const path = `${url.origin}${url.pathname}`;
      requests.set(data.requestId, path);
      record({ event: 'request', id: data.requestId, url: path });
    }
  );
  view.addEventListener<{
    requestId: string;
    response: { status: number; protocol: string; timing?: unknown };
  }>('Network.responseReceived', ({ data }) => {
    if (!requests.has(data.requestId)) return;
    record({
      event: 'response',
      id: data.requestId,
      status: data.response.status,
      protocol: data.response.protocol,
      timing: data.response.timing,
    });
  });
  view.addEventListener<{
    requestId: string;
    errorText: string;
    blockedReason?: string;
    canceled?: boolean;
  }>('Network.loadingFailed', ({ data }) => {
    if (!requests.has(data.requestId)) return;
    record({
      event: 'failed',
      id: data.requestId,
      error: data.errorText,
      blocked: data.blockedReason,
      canceled: data.canceled,
    });
    requests.delete(data.requestId);
  });
  view.addEventListener<{ requestId: string }>(
    'Network.loadingFinished',
    ({ data }) => {
      requests.delete(data.requestId);
    }
  );
  return lines;
}
