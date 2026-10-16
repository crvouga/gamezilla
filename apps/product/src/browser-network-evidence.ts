function onNetwork<T>(
  view: Bun.WebView,
  type: `Network.${string}`,
  listener: (data: T) => void
): void {
  view.addEventListener(type, (event) => {
    // Bun's event declaration resolves to the constructor under the DOM lib.
    listener((event as unknown as { data: T }).data);
  });
}

/** Sanitized transport evidence: no request bodies, query strings or credentials. */
export function browserNetworkEvidence(view: Bun.WebView): string[] {
  const lines: string[] = [];
  const requests = new Map<string, string>();
  const record = (entry: unknown): void => {
    lines.push(JSON.stringify(entry));
    if (lines.length > 200) lines.shift();
  };
  onNetwork<{ requestId: string; request: { url: string } }>(
    view,
    'Network.requestWillBeSent',
    (data) => {
      const url = new URL(data.request.url);
      if (!url.pathname.startsWith('/api/')) return;
      const path = `${url.origin}${url.pathname}`;
      requests.set(data.requestId, path);
      record({ event: 'request', id: data.requestId, url: path });
    }
  );
  onNetwork<{
    requestId: string;
    response: { status: number; protocol: string; timing?: unknown };
  }>(view, 'Network.responseReceived', (data) => {
    if (!requests.has(data.requestId)) return;
    record({
      event: 'response',
      id: data.requestId,
      status: data.response.status,
      protocol: data.response.protocol,
      timing: data.response.timing,
    });
  });
  onNetwork<{
    requestId: string;
    errorText: string;
    blockedReason?: string;
    canceled?: boolean;
  }>(view, 'Network.loadingFailed', (data) => {
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
  onNetwork<{ requestId: string }>(view, 'Network.loadingFinished', (data) => {
    requests.delete(data.requestId);
  });
  return lines;
}
