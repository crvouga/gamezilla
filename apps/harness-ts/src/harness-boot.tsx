import type { JSX } from '@solidjs/web';
import { RootApp } from './root-app';
import { wallConsoleEnv } from './wall-console-env';

/** The console over the system it boots in this tab. */
export function HarnessBoot(): JSX.Element {
  const env = wallConsoleEnv();
  return <RootApp env={env} />;
}
