import { iotEndpointHost } from './create-iot-http-pubsub';

type ProbeOptions = {
  readonly endpoint: string;
  readonly fetchImpl: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};

/** An unsigned publish reaches the data plane only when its authorization gate refuses it. */
export async function probeIotDataPlane(
  options: ProbeOptions
): Promise<boolean> {
  const host = iotEndpointHost(options.endpoint);
  const response = await options.fetchImpl(
    `https://${host}/topics/health-ping?qos=1`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: '{}',
    }
  );
  await response.body?.cancel();
  return response.status === 403;
}
