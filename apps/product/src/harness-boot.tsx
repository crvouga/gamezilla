import type { JSX } from 'solid-js';
import { RootApp } from './root-app';
import { wallConsoleEnv } from './wall-console-env';

/** The harness code is imported eagerly; its environment is created when mounted. */
export function HarnessBoot(): JSX.Element {
  const env = wallConsoleEnv();
  return <RootApp env={env} />;
}
