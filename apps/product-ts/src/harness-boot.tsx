import type { JSX } from 'solid-js';
import { RootApp } from './root-app';
import { wallConsoleEnv } from './wall-console-env';

/** The harness graph is loaded only when the page opens on `/harness`. */
export function HarnessBoot(): JSX.Element {
  const env = wallConsoleEnv();
  return <RootApp env={env} />;
}
