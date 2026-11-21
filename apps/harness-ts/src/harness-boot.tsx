import type { JSX } from 'solid-js';
import type { HarnessSessions } from './harness-bug-reports';
import { RootApp } from './root-app';
import { wallConsoleEnv } from './wall-console-env';

/** The console over the system it boots in this tab. */
export function HarnessBoot(props: {
  readonly sessions: HarnessSessions;
}): JSX.Element {
  const env = wallConsoleEnv(props.sessions);
  return <RootApp env={env} />;
}
