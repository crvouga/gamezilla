import {
  assertValidTopic,
  encodePayload,
  PubSubClosedError,
  PubSubNotSupportedError,
  PubSubPublishError,
  type PubSub,
  type PubSubStatus,
  type Topic,
} from '@pkgs/pubsub/interface';

export type EmqxHttpPubSubOptions = {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  fetchImpl?: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};

function basicAuthHeader(apiKey: string, apiSecret: string): string {
  const token = btoa(`${apiKey}:${apiSecret}`);
  return `Basic ${token}`;
}

/**
 * Publish-only PubSub via EMQX HTTP API (`POST /api/v5/publish`).
 * Workers-safe: uses injected or global `fetch` only.
 */
export function createEmqxHttpPubSub(options: EmqxHttpPubSubOptions): PubSub {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.apiBaseUrl.replace(/\/$/, '');
  const auth = basicAuthHeader(options.apiKey, options.apiSecret);
  let closed = false;

  return {
    async publish(topic: Topic, data: unknown): Promise<void> {
      if (closed) throw new PubSubClosedError();
      assertValidTopic(topic);
      const payload = encodePayload(data);
      const res = await fetchImpl(`${base}/api/v5/publish`, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          topic,
          payload,
          qos: 0,
          retain: false,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new PubSubPublishError(
          `EMQX publish failed: ${String(res.status)}`,
          res.status,
          body
        );
      }
    },

    subscribe(_topic: Topic, _handler: (data: unknown) => void): () => void {
      throw new PubSubNotSupportedError(
        'createEmqxHttpPubSub does not support subscribe'
      );
    },

    status(): PubSubStatus {
      return closed ? 'down' : 'connected';
    },

    onStatus(_cb: (s: PubSubStatus) => void): () => void {
      return () => undefined;
    },

    close(): void {
      closed = true;
    },
  };
}
