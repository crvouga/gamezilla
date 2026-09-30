import { describe, expect, test } from 'bun:test';
import {
  createIotHttpPubSub,
  iotWireTopic,
  signAws4,
} from '@pkgs/pubsub/iot';
import { PubSubPublishError } from '@pkgs/pubsub/interface';

const EMPTY_SHA =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('iot wire topics', () => {
  test('colon topics become slash topics', () => {
    expect(iotWireTopic('user:actor1')).toBe('user/actor1');
    expect(iotWireTopic('system:client_config')).toBe('system/client_config');
    expect(iotWireTopic('room:space_a')).toBe('room/space_a');
    expect(iotWireTopic('health-ping')).toBe('health-ping');
  });
});

describe('SigV4', () => {
  test('matches the AWS GET example', async () => {
    const signed = await signAws4({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      query: '',
      region: 'us-east-1',
      service: 's3',
      payload: new Uint8Array(),
      nowMs: Date.UTC(2013, 4, 24),
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      headers: { range: 'bytes=0-9' },
    });
    expect(signed.amzDate).toBe('20130524T000000Z');
    expect(signed.payloadHash).toBe(EMPTY_SHA);
    expect(signed.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'
    );
  });
});

describe('createIotHttpPubSub', () => {
  test('posts the encoded payload to the slash topic', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const pubsub = createIotHttpPubSub({
      endpoint: 'aaaa.iot.us-east-1.amazonaws.com',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      now: () => Date.UTC(2013, 4, 24),
      fetchImpl: (input, init) => {
        calls.push({ url: String(input), init });
        return Promise.resolve(new Response(null, { status: 200 }));
      },
    });
    await pubsub.publish('user:actor1', { ok: true });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe(
      'https://aaaa.iot.us-east-1.amazonaws.com/topics/user%2Factor1?qos=1'
    );
    expect(call?.init?.method).toBe('POST');
    expect(new TextDecoder().decode(call?.init?.body as Uint8Array)).toBe(
      '{"ok":true}'
    );
    const headers = call?.init?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toStartWith('AWS4-HMAC-SHA256 ');
    expect(headers?.['host']).toBeUndefined();
  });

  test('a non-200 publish fails', async () => {
    const pubsub = createIotHttpPubSub({
      endpoint: 'https://aaaa.iot.us-east-1.amazonaws.com',
      accessKeyId: 'AKID',
      secretAccessKey: 'secret',
      region: 'us-east-1',
      now: () => 0,
      fetchImpl: () => Promise.resolve(new Response('no', { status: 403 })),
    });
    await expect(pubsub.publish('health-ping', { ok: true })).rejects.toBeInstanceOf(
      PubSubPublishError
    );
  });
});
