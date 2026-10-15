import type { HttpClient } from '@pkgs/http-client-shared/types';
import type { PubSub, PubSubStatus } from './interface';
import { encodePayload } from './payload';
import { PubSubClosedError } from './pubsub-closed-error';
import { PubSubNotSupportedError } from './pubsub-not-supported-error';
import { PubSubPublishError } from './pubsub-publish-error';
import { signAws4 } from './sign-aws4';
import type { Topic } from './topic';
import { assertValidTopic } from './topic';
import { iotWireTopic } from './wire-topic';

export type IotHttpPubSubOptions = {
  /** Data-plane hostname, or an https URL whose host is that hostname. */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  now: () => number;
  http: HttpClient;
};

export function createIotHttpPubSub(options: IotHttpPubSubOptions): PubSub {
  const host = iotEndpointHost(options.endpoint);
  let closed = false;

  return {
    publish(topic: Topic, data: unknown): Promise<void> {
      if (closed) throw new PubSubClosedError();
      return publishIot({ options, host, topic, data });
    },
    subscribe(): () => void {
      throw new PubSubNotSupportedError(
        'createIotHttpPubSub does not support subscribe'
      );
    },
    status(): PubSubStatus {
      return closed ? 'down' : 'connected';
    },
    onStatus(): () => void {
      return () => undefined;
    },
    close(): void {
      closed = true;
    },
  };
}

export function iotEndpointHost(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/$/, '');
  if (trimmed.includes('://')) return new URL(trimmed).host;
  const host = trimmed.split('/')[0];
  return host ?? trimmed;
}

async function publishIot(args: {
  readonly options: IotHttpPubSubOptions;
  readonly host: string;
  readonly topic: Topic;
  readonly data: unknown;
}): Promise<void> {
  assertValidTopic(args.topic);
  const payload = new TextEncoder().encode(encodePayload(args.data));
  const path = `/topics/${encodeURIComponent(iotWireTopic(args.topic))}`;
  const signed = await signAws4({
    method: 'POST',
    host: args.host,
    path,
    query: 'qos=1',
    region: args.options.region,
    service: 'iotdevicegateway',
    payload,
    nowMs: args.options.now(),
    accessKeyId: args.options.accessKeyId,
    secretAccessKey: args.options.secretAccessKey,
    headers: { 'content-type': 'application/octet-stream' },
  });
  const headers = requestHeaders(signed.headers, signed.authorization);
  const res = await args.options.http.fetch(
    `https://${args.host}${path}?qos=1`,
    {
      method: 'POST',
      headers,
      body: payload,
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new PubSubPublishError(
      `IoT publish failed: ${String(res.status)}`,
      res.status,
      body
    );
  }
}

function requestHeaders(
  signed: Readonly<Record<string, string>>,
  authorization: string
): Record<string, string> {
  const headers: Record<string, string> = { Authorization: authorization };
  for (const [name, value] of Object.entries(signed)) {
    if (name === 'host') continue;
    headers[name] = value;
  }
  return headers;
}
