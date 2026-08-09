import { cliIo } from '../lib/cli-io';
import { stepDone, stepFail } from '../lib/fmt';

export interface CiPlatform {
  error(message: string): void;
  warning(message: string): void;
  notice(message: string): void;
  startGroup(title: string): void;
  endGroup(): void;
  readonly enforceDeployRole: boolean;
  setOutput(name: string, value: string): void;
}

export async function runStep<T>(
  platform: CiPlatform,
  label: string,
  fn: () => T | Promise<T>
): Promise<T> {
  platform.startGroup(label);
  const t0 = cliIo.clock.now();
  try {
    const result = await fn();
    const ms = cliIo.clock.now() - t0;
    platform.endGroup();
    stepDone(label, ms);
    return result;
  } catch (e) {
    const ms = cliIo.clock.now() - t0;
    platform.endGroup();
    stepFail(label, ms);
    throw e;
  }
}
