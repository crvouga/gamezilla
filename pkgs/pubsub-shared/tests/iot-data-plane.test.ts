import { expect, test } from 'bun:test';
import { probeIotDataPlane } from '@pkgs/pubsub-shared/probe-iot-data-plane';

// regression: health-iot-root-is-not-publish
test('probes the publish authorization gate when the root is absent', async () => {
  const requests: { path: string; init: RequestInit | undefined }[] = [];
  const ready = await probeIotDataPlane({
    endpoint: 'iot.example.test',
    async fetchImpl(input, init) {
      const path = new URL(String(input)).pathname;
      requests.push({ path, init });
      return new Response('', { status: path === '/' ? 404 : 403 });
    },
  });
  expect(ready).toBe(true);
  expect(requests[0]?.path).toBe('/topics/health-ping');
  expect(requests[0]?.init?.method).toBe('POST');
  expect(requests[0]?.init?.headers).toEqual({
    'content-type': 'application/octet-stream',
  });
});

test('a missing endpoint or an accepted unsigned publish is not ready', async () => {
  for (const status of [200, 404, 500]) {
    expect(
      await probeIotDataPlane({
        endpoint: 'iot.example.test',
        fetchImpl: async () => new Response('', { status }),
      })
    ).toBe(false);
  }
});
