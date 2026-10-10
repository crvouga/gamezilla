import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** Erlang's generated crash-dump argument requires a whitespace-free log path. */
export function brokerLogDirectory(
  dataDirectory: string,
  temporaryDirectory: string
): string {
  const regular = join(dataDirectory, 'log');
  if (!/\s/.test(regular)) return regular;
  if (/\s/.test(temporaryDirectory))
    throw new Error(
      'The broker requires a temporary directory without whitespace'
    );
  const identity = createHash('sha256')
    .update(dataDirectory)
    .digest('hex')
    .slice(0, 32);
  return join(temporaryDirectory, `emqx-log-${identity}`);
}
