import type { Timers } from '@pkgs/clock-shared/types';
import { createDeadlineFetch } from '@pkgs/http-client-shared/deadline-fetch';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import {
  mqttPushEvidence,
  syncRequestEvidence,
  syncResponseEvidence,
} from './browser-sync-evidence';

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

function socketEvidence(
  view: Bun.WebView,
  record: (entry: unknown) => void
): void {
  const protocols = new Map<string, number>();
  onNetwork<{ requestId: string; url: string }>(
    view,
    'Network.webSocketCreated',
    (data) => {
      const url = new URL(data.url);
      protocols.set(data.requestId, url.protocol === 'wss:' ? 5 : 4);
      record({
        event: 'socket',
        id: data.requestId,
        url: `${url.origin}${url.pathname}`,
      });
    }
  );
  onNetwork<{
    requestId: string;
    response: { opcode: number; payloadData: string };
  }>(view, 'Network.webSocketFrameReceived', (data) => {
    if (data.response.opcode !== 2) return;
    const push = mqttPushEvidence(
      data.response.payloadData,
      protocols.get(data.requestId) ?? 4
    );
    if (push !== undefined)
      record({ event: 'push', id: data.requestId, ...push });
  });
  onNetwork<{ requestId: string; response: { status: number } }>(
    view,
    'Network.webSocketHandshakeResponseReceived',
    (data) => {
      record({
        event: 'socket-response',
        id: data.requestId,
        status: data.response.status,
      });
    }
  );
  onNetwork<{ requestId: string; errorMessage: string }>(
    view,
    'Network.webSocketFrameError',
    (data) => {
      record({
        event: 'socket-error',
        id: data.requestId,
        error: data.errorMessage.replace(/\w+:\/\/\S+/g, '[url]'),
      });
    }
  );
  onNetwork<{ requestId: string }>(view, 'Network.webSocketClosed', (data) => {
    record({ event: 'socket-closed', id: data.requestId });
  });
}

/** Sanitized transport evidence: names and row counts, never bodies or credentials. */
export function browserNetworkEvidence(view: Bun.WebView): string[] {
  const lines: string[] = [];
  const requests = new Map<string, string>();
  const record = (entry: unknown): void => {
    lines.push(JSON.stringify(entry));
    if (lines.length > 200) lines.shift();
  };
  socketEvidence(view, record);
  onNetwork<{ requestId: string; request: { url: string; postData?: string } }>(
    view,
    'Network.requestWillBeSent',
    (data) => {
      const url = new URL(data.request.url);
      if (!url.pathname.startsWith('/api/')) return;
      const path = `${url.origin}${url.pathname}`;
      requests.set(data.requestId, path);
      record({
        event: 'request',
        id: data.requestId,
        url: path,
        names: syncRequestEvidence(path, data.request.postData),
      });
    }
  );
  onNetwork<{
    requestId: string;
    response: {
      status: number;
      protocol: string;
      timing?: unknown;
      remoteIPAddress?: string;
      fromServiceWorker?: boolean;
    };
  }>(view, 'Network.responseReceived', (data) => {
    if (!requests.has(data.requestId)) return;
    record({
      event: 'response',
      id: data.requestId,
      status: data.response.status,
      protocol: data.response.protocol,
      peer: data.response.remoteIPAddress,
      serviceWorker: data.response.fromServiceWorker,
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

/** Bun permits one pending CDP command: collect bodies only after the failed gesture. */
export async function readSyncResponseEvidence(
  view: Pick<Bun.WebView, 'cdp'>,
  lines: readonly string[]
): Promise<string[]> {
  const summaries: string[] = [];
  for (const line of [...lines]) {
    const event = JSON.parse(line) as {
      event: string;
      id: string;
      url?: string;
    };
    if (
      event.event !== 'request' ||
      !event.url ||
      !/\/(query|mutations)$/.test(event.url)
    )
      continue;
    try {
      const response = (await view.cdp('Network.getResponseBody', {
        requestId: event.id,
      })) as { body: string; base64Encoded?: boolean };
      const body = response.base64Encoded
        ? Buffer.from(response.body, 'base64').toString('utf8')
        : response.body;
      summaries.push(
        JSON.stringify({
          event: 'sync-response',
          id: event.id,
          summary: syncResponseEvidence(event.url, body),
        })
      );
    } catch {
      // Chrome may already have discarded an old response body.
    }
  }
  return summaries;
}

export async function nativeHealthEvidence(
  http: HttpClient,
  url: string,
  timers: Timers
): Promise<string> {
  const request = createDeadlineFetch({
    fetch: (input, init) => http.fetch(input, init),
    timers,
    timeoutMs: 5000,
  });
  try {
    const response = await request(url);
    return JSON.stringify({
      status: response.status,
      body: await response.text(),
    });
  } catch (error) {
    return JSON.stringify({ error: String(error) });
  }
}
