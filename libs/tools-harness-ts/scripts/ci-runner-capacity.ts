/** Push to a posted verdict, including a full cold corpus. */
export const PR_VERIFY_SECONDS = 300;
/** Every graph leaf, including the slowest one. */
export const LEAF_VERIFY_SECONDS = 180;
/** Nine out of ten leaves. */
export const NARROW_VERIFY_SECONDS = 90;
/** Fetch, plan, and cache lookup on a runner that already has the install. */
export const WARM_START_SECONDS = 30;
/** Post the verdict after the last task. */
export const SLACK_SECONDS = 15;
/** Conservative slot-allocation target; the hard deadline also reserves slack. */
export const WORK_BUDGET_SECONDS = 240;
/** Same cap as `specWorkerCeiling` in `@pkgs/os-server-ts`. */
export const SPEC_WORKER_CAP = 16;
/** Two cores stay free for the model solver and the OS. */
export const RESERVED_CORES = 2;
/** One product world, rounded up from the measured 1.7 GB. */
export const SPEC_WORKER_GIB = 2;
/** RAM left for the OS, the solver, and the report writer. */
export const RESERVE_GIB = 8;
/** Planned machine shape. The fit test fails when the corpus needs more. */
export const RUNNER_VCPU = 32;
export const RUNNER_RAM_GIB = 64;
export const RUNNERS_PER_VERIFICATION = 3;
export const CONCURRENT_VERIFICATIONS = 2;
export const RUNNER_COUNT = RUNNERS_PER_VERIFICATION * CONCURRENT_VERIFICATIONS;

export type RunnerFit = {
  readonly runners: number;
  readonly specSlots: number;
  readonly otherSlots: number;
  readonly cores: number;
  readonly memoryGib: number;
  readonly makespanSeconds: number;
  readonly fits: boolean;
};

export type RunnerLoad = {
  readonly specSeconds: number;
  readonly coldSeconds: number;
  readonly poleSeconds: number;
  readonly leafPoleMax: number;
  readonly leafPoleP90: number;
};

/** Slots and memory the warm runner needs for this corpus. */
export function runnerFit(load: RunnerLoad): RunnerFit {
  const specSlots = Math.min(SPEC_WORKER_CAP, slotsFor(load.specSeconds));
  const otherSlots = slotsFor(Math.max(0, load.coldSeconds - load.specSeconds));
  const preferred = placeOnRunner(load, specSlots, otherSlots);
  if (preferred.fits) return preferred;
  const available = Math.max(0, RUNNER_VCPU - RESERVED_CORES - specSlots);
  const bounded = placeOnRunner(
    load,
    specSlots,
    Math.min(otherSlots, available)
  );
  return bounded.fits ? bounded : preferred;
}

function placeOnRunner(
  load: RunnerLoad,
  specSlots: number,
  otherSlots: number
): RunnerFit {
  const otherSeconds = Math.max(0, load.coldSeconds - load.specSeconds);
  const cores = specSlots + RESERVED_CORES + otherSlots;
  const memoryGib = specSlots * SPEC_WORKER_GIB + RESERVE_GIB;
  const makespanSeconds = Math.ceil(
    Math.max(
      load.poleSeconds,
      span(load.specSeconds, specSlots),
      span(otherSeconds, otherSlots)
    )
  );
  const fits =
    specSlots <= SPEC_WORKER_CAP &&
    cores <= RUNNER_VCPU &&
    memoryGib <= RUNNER_RAM_GIB &&
    makespanSeconds + WARM_START_SECONDS + SLACK_SECONDS <= PR_VERIFY_SECONDS &&
    load.leafPoleMax + WARM_START_SECONDS + SLACK_SECONDS <=
      LEAF_VERIFY_SECONDS &&
    load.leafPoleP90 + WARM_START_SECONDS + SLACK_SECONDS <=
      NARROW_VERIFY_SECONDS;
  return {
    runners: 1,
    specSlots,
    otherSlots,
    cores,
    memoryGib,
    makespanSeconds,
    fits,
  };
}

function slotsFor(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / WORK_BUDGET_SECONDS);
}

function span(seconds: number, slots: number): number {
  if (slots <= 0) return seconds > 0 ? Number.POSITIVE_INFINITY : 0;
  return seconds / slots;
}

/** Fit a bounded warm pool; an indivisible task keeps its full duration. */
export function runnerPoolFit(load: RunnerLoad): RunnerFit {
  for (let runners = 1; runners <= RUNNERS_PER_VERIFICATION; runners++) {
    const fit = runnerFit({
      ...load,
      coldSeconds: load.coldSeconds / runners,
      specSeconds: load.specSeconds / runners,
    });
    if (fit.fits || runners === RUNNERS_PER_VERIFICATION)
      return { ...fit, runners };
  }
  throw new Error('Runner pool must have at least one machine');
}
