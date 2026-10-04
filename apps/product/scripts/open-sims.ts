#!/usr/bin/env bun

// @io-wall-ok

import {
  cancel,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  spinner,
} from '@clack/prompts';
import {
  bootSimIfNeeded,
  openSimulatorApp,
  resolveProjectSim,
} from './sim-runtime';
import type { SimSpecId } from './sim-spec';
import { SIM_SPEC } from './sim-spec';
import { findDeviceByName } from './simctl';

const LOG_PREFIX = '[sims:open]';

function simDisplayTitle(id: SimSpecId): string {
  if (id === 'iphone') return 'iPhone';
  if (id === 'ipad') return 'iPad';
  return id;
}

function deviceHint(name: string): { hint: string; disabled: boolean } {
  const device = findDeviceByName(name);
  if (device === undefined) {
    return {
      hint: 'missing — run bun run sims:setup',
      disabled: true,
    };
  }
  return { hint: device.state, disabled: false };
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    process.stderr.write(
      `${LOG_PREFIX} iOS Simulator open requires macOS with Xcode.\n`
    );
    process.exit(1);
  }

  intro('Open project simulators');

  const options = SIM_SPEC.map((entry) => {
    const { hint, disabled } = deviceHint(entry.name);
    return {
      value: entry.id,
      label: `${simDisplayTitle(entry.id)}  ${entry.name}`,
      hint,
      disabled,
    };
  });

  const selectable = options.filter((row) => !row.disabled);
  if (selectable.length === 0) {
    note(
      'No project simulators found.\nRun `bun run sims:setup` first, then try again.',
      'Missing simulators'
    );
    process.exit(1);
  }

  const selected = await multiselect({
    message: 'Which simulators should open?',
    options,
    required: true,
  });

  if (isCancel(selected)) {
    cancel('Cancelled.');
    process.exit(0);
  }

  const ids = selected as SimSpecId[];
  const boot = spinner();
  boot.start(`Opening ${String(ids.length)} simulator(s)…`);

  for (const id of ids) {
    const { udid, name } = resolveProjectSim(id);
    bootSimIfNeeded(udid, name, (message) => {
      boot.message(message);
    });
  }

  openSimulatorApp();
  boot.stop(`Opened ${ids.map(simDisplayTitle).join(', ')}`);

  outro('Simulator.app is ready.');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  process.exit(1);
});
