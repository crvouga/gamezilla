#!/usr/bin/env bun

// @io-wall-ok

import { SIM_SPEC } from './sim-spec';
import { assertSimSpecPrerequisites, reconcileSim } from './simctl';

function main(): void {
  if (process.platform !== 'darwin') {
    process.stderr.write(
      '[setup:sims] iOS Simulator setup requires macOS with Xcode.\n'
    );
    process.exit(1);
  }

  assertSimSpecPrerequisites(SIM_SPEC);

  for (const entry of SIM_SPEC) {
    reconcileSim(entry);
  }

  process.stderr.write('[setup:sims] Done.\n');
}

main();
