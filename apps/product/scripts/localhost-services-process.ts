// @io-wall-ok — launches the Node-conditions local service sidecar.
export type LocalhostServicesProcess = {
  readonly origin: string;
  stop(): Promise<void>;
};

export async function startLocalhostServices(): Promise<LocalhostServicesProcess> {
  const child = Bun.spawn(
    ['bun', './apps/product/scripts/localhost-services.ts'],
    {
      cwd: `${import.meta.dir}/../../..`,
      env: { ...process.env, NODE_ENV: 'production' },
      stdout: 'pipe',
      stderr: 'inherit',
    }
  );
  const stream = child.stdout;
  if (stream === null || typeof stream === 'number') {
    throw new Error('localhost services stdout unavailable');
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  const ready = new Promise<string>((resolve, reject) => {
    void (async () => {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffered += decoder.decode(chunk.value, { stream: true });
          let end = buffered.indexOf('\n');
          while (end >= 0) {
            const line = buffered.slice(0, end).trim();
            buffered = buffered.slice(end + 1);
            if (line.startsWith('LOCALHOST_SERVICES_ORIGIN=')) {
              resolve(line.slice('LOCALHOST_SERVICES_ORIGIN='.length));
            } else if (line !== '') {
              process.stdout.write(`${line}\n`);
            }
            end = buffered.indexOf('\n');
          }
        }
        reject(
          new Error(
            `localhost services exited ${String(await child.exited)} before ready`
          )
        );
      } catch (error) {
        reject(error);
      }
    })();
  });
  try {
    const origin = await ready;
    return {
      origin,
      async stop() {
        child.kill('SIGTERM');
        await child.exited;
      },
    };
  } catch (error) {
    child.kill('SIGTERM');
    await child.exited;
    throw error;
  }
}
