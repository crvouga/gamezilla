/** Quick tunnels create runtime connections, without provisioning DNS or account resources. */
export function quickPreviewCommand(args: {
  readonly origin: string;
  readonly hostname: string;
  readonly configPath: string;
  readonly emails: readonly string[];
}): readonly string[] {
  const origin = new URL(args.origin);
  if (
    origin.protocol !== 'http:' ||
    origin.hostname !== '127.0.0.1' ||
    origin.port === '' ||
    origin.pathname !== '/' ||
    origin.search !== '' ||
    origin.hash !== '' ||
    origin.username !== '' ||
    origin.password !== ''
  )
    throw new Error(
      'Preview requires this checkout’s explicit HTTP loopback listener'
    );
  if (args.emails.length === 0)
    throw new Error('Preview requires allowed developer emails');
  return [
    'tunnel',
    '--config',
    args.configPath,
    '--no-autoupdate',
    '--metrics',
    '127.0.0.1:0',
    '--protocol',
    'http2',
    '--url',
    origin.origin,
    '--http-host-header',
    args.hostname,
    ...args.emails.flatMap((email) => ['--allowed-mail', email]),
  ];
}
