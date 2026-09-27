import type { SeededRng } from '@pkgs/uuid';
import type { VirtualClock } from './clock';
import { waitQuiescence } from './idle';
import {
  advanceToNextDue,
  assertDrainBudget,
  assertQuiescentBudget,
  type DrainBudget,
  withinRunUntilBudget,
} from './scheduler-limits';
import type { InFlightTask, Task } from './scheduler-types';
import { choose } from './step';
import type { TraceRecorder } from './trace';

export type { InFlightTask, Task, TaskBody } from './scheduler-types';

export type DrainContext = {
  readonly heap: Task[];
  readonly clock: VirtualClock;
  readonly choiceRng?: SeededRng;
  readonly trace?: TraceRecorder;
  readonly inFlight: InFlightTask[];
  /** Fired-Task counter for this drain; bounds every drain loop. */
  readonly budget: DrainBudget;
  /** Shared across drains; see {@link DrainStats}. */
  readonly stats: DrainStats;
};

/**
 * Counts advances the drain made while wall work was still in flight.
 *
 * `drainInFlightWallWork` gives a starved process only so many macrotask turns
 * before it moves virtual time anyway, to avoid deadlocking on a task that is
 * really waiting for a future timer. On a contended machine that guess is
 * wrong often enough to matter: virtual time runs ahead of the work, and a
 * scenario's `until` budget drains without the system having progressed. The
 * count lets a waiter tell that apart from "the product never got there".
 */
export type DrainStats = { starvedAdvances: number };

export function pushTask(heap: Task[], item: Task): void {
  heap.push(item);
  heap.sort((a, b) => a.at - b.at || a.id - b.id);
}

/** All heap entries sharing the earliest due time, if that time is ≤ now. */
function dueAt(heap: Task[], now: number): Task[] {
  if (heap.length === 0 || heap[0]!.at > now) return [];
  const at = heap[0]!.at;
  const out: Task[] = [];
  for (const q of heap) {
    if (q.at !== at) break;
    out.push(q);
  }
  return out;
}

function takeDue(heap: Task[], picked: Task): void {
  const idx = heap.indexOf(picked);
  if (idx >= 0) heap.splice(idx, 1);
}

function startTask(ctx: DrainContext, item: Task): InFlightTask {
  ctx.trace?.record({
    type: 'task_fire',
    taskId: item.id,
    at: ctx.clock.now(),
  });
  const tracked: InFlightTask = {
    taskId: item.id,
    label: item.label,
    settled: false,
    error: undefined,
    promise: Promise.resolve()
      .then(() => item.run())
      .then(
        () => {
          tracked.settled = true;
        },
        (err: unknown) => {
          tracked.settled = true;
          tracked.error = err;
        }
      ),
  };
  ctx.inFlight.push(tracked);
  return tracked;
}

function pruneInFlight(ctx: DrainContext): void {
  for (let i = ctx.inFlight.length - 1; i >= 0; i -= 1) {
    if (ctx.inFlight[i]!.settled) ctx.inFlight.splice(i, 1);
  }
}

function firstInFlightError(ctx: DrainContext): unknown {
  for (const t of ctx.inFlight) {
    if (t.settled && t.error !== undefined) return t.error;
  }
  return undefined;
}

function deadlockMessage(ctx: DrainContext): string {
  const names = ctx.inFlight
    .filter((t) => !t.settled)
    .map((t) => `${t.label}#${t.taskId}`)
    .join(', ');
  return (
    `Scheduler: deadlock — task(s) awaiting promise not managed by the ` +
    `simulation: ${names || '(unknown)'}`
  );
}

/**
 * Fire one due Task (same-time ties resolved by the scheduling Step), then
 * wait until either the Task settles or the microtask queue is quiescent.
 * Unsettled Tasks stay in-flight (suspended on unmanaged promises).
 */
export async function fireOneDue(ctx: DrainContext): Promise<boolean> {
  const now = ctx.clock.now();
  const due = dueAt(ctx.heap, now);
  if (due.length === 0) return false;

  ctx.budget.steps += 1;
  assertDrainBudget(ctx.budget, ctx.heap);

  const picked =
    ctx.choiceRng !== undefined
      ? choose(ctx.choiceRng, 'scheduler/next', due, ctx.trace)
      : due[0]!;
  takeDue(ctx.heap, picked);
  const tracked = startTask(ctx, picked);

  await Promise.race([tracked.promise, waitQuiescence()]);

  const err = firstInFlightError(ctx);
  if (err !== undefined) throw err;
  pruneInFlight(ctx);
  return true;
}

/** Fire all currently-due Tasks one-at-a-time with quiescence between. */
export async function fireDueTasks(ctx: DrainContext): Promise<number> {
  let steps = 0;
  const burstLimit = 10_000;
  while (steps < burstLimit) {
    const fired = await fireOneDue(ctx);
    if (!fired) break;
    steps += 1;
  }
  return steps;
}

/**
 * Max macrotask probes before advancing virtual time to unblock tasks that
 * await a future sim timer. High enough that multi-hop wall I/O (SQLite,
 * Promise chains via setImmediate) finishes at the *same* virtual `now` on
 * record and replay — advancing while that work is still pending makes
 * `scheduleAfter` deadlines drift and breaks Trace replay.
 *
 * A probe is one macrotask, so the ceiling is really "how many event-loop
 * turns can that I/O need". 64 was enough on an idle machine and not enough on
 * a busy one: with the sim suites running in parallel, a contended process
 * spent its 64 turns without the SQLite round-trip landing, virtual time moved
 * anyway, and scenario deadlines burned while nothing progressed — a flake
 * that looked like a slow product rather than a starved drain.
 *
 * The number is patience, not a deadline: the loop exits on the first probe
 * once the work has settled, so a high ceiling costs nothing on an idle
 * machine and only spends microseconds of macrotask turns on a starved one.
 * It is sized for the worst runner the gate runs on — two shared cores — not
 * for the laptop that writes the scenario. Deadlock is still caught, by
 * `settleOrDeadlock` and by the drain's fired-task budget. Raising it further
 * did not help: 4096 measured the same as 512, because past a point the drain
 * is no longer what is starved.
 *
 * TODO(dst-audit): D4 — replace with registered Effects (Phase 3.3).
 */
const MAX_WALL_SPINS_BEFORE_ADVANCE = 512;

function throwIfInFlightError(ctx: DrainContext): void {
  const err = firstInFlightError(ctx);
  if (err !== undefined) throw err;
}

function inFlightPending(ctx: DrainContext): boolean {
  return ctx.inFlight.some((t) => !t.settled);
}

/**
 * Give unsettled tasks wall-clock macrotask turns (and fire any newly due
 * sim Tasks they schedule) before the drain advances virtual time.
 * @returns true when no in-flight work remains
 */
async function drainInFlightWallWork(ctx: DrainContext): Promise<boolean> {
  let spins = 0;
  for (;;) {
    pruneInFlight(ctx);
    throwIfInFlightError(ctx);
    if (!inFlightPending(ctx)) return true;

    const due = dueAt(ctx.heap, ctx.clock.now());
    if (due.length > 0) {
      await fireOneDue(ctx);
      spins = 0;
      continue;
    }

    if (spins >= MAX_WALL_SPINS_BEFORE_ADVANCE) return false;
    await waitQuiescence();
    spins += 1;
  }
}

async function settleOrDeadlock(
  ctx: DrainContext,
  end?: number
): Promise<void> {
  for (;;) {
    const settled = await drainInFlightWallWork(ctx);
    if (settled) return;

    if (ctx.heap.length === 0) {
      throw new Error(deadlockMessage(ctx));
    }
    const nextAt = ctx.heap[0]!.at;
    if (end !== undefined && nextAt > end) {
      throw new Error(deadlockMessage(ctx));
    }
    // Moving the clock with work still in flight: the drain ran out of
    // patience, not the simulation out of things to do.
    ctx.stats.starvedAdvances += 1;
    ctx.clock.set(nextAt);
    await fireOneDue(ctx);
  }
}

export async function runForDuration(
  ctx: DrainContext,
  durationMs: number
): Promise<void> {
  const end = ctx.clock.now() + Math.max(0, durationMs);
  for (;;) {
    await fireDueTasks(ctx);
    if (inFlightPending(ctx)) {
      await settleOrDeadlock(ctx, end);
    }
    if (ctx.heap.length === 0) {
      ctx.clock.set(end);
      return;
    }
    if (ctx.heap[0]!.at > end) {
      ctx.clock.set(end);
      return;
    }
    ctx.clock.set(ctx.heap[0]!.at);
  }
}

/**
 * Time passes while nothing runs — a device asleep overnight, a closed
 * laptop: the work due now settles, the clock jumps `durationMs`, and every
 * Task that fell due meanwhile fires once at the far end, in due order. An
 * interval fires once on waking, not once per period it slept through, so a
 * day passes in the Tasks it takes to wake rather than a day of ticks.
 */
export async function sleepForDuration(
  ctx: DrainContext,
  durationMs: number
): Promise<void> {
  await runForDuration(ctx, 0);
  ctx.clock.set(ctx.clock.now() + Math.max(0, durationMs));
  await runForDuration(ctx, 0);
}

export async function runUntilQuiescentHeap(
  ctx: DrainContext,
  opts?: { readonly maxSteps?: number; readonly maxVirtualMs?: number }
): Promise<void> {
  const maxSteps = opts?.maxSteps ?? 100_000;
  const maxVirtualMs = opts?.maxVirtualMs ?? 86_400_000;
  const start = ctx.clock.now();
  let steps = 0;
  let quiescentRounds = 0;
  while (quiescentRounds < 3) {
    assertQuiescentBudget({
      steps,
      maxSteps,
      clock: ctx.clock,
      start,
      maxVirtualMs,
    });
    pruneInFlight(ctx);
    if (ctx.heap.length === 0) {
      if (inFlightPending(ctx)) {
        await settleOrDeadlock(ctx);
        quiescentRounds = 0;
        continue;
      }
      await waitQuiescence();
      pruneInFlight(ctx);
      quiescentRounds =
        ctx.heap.length === 0 && ctx.inFlight.length === 0
          ? quiescentRounds + 1
          : 0;
      continue;
    }
    quiescentRounds = 0;
    steps += await fireDueTasks(ctx);
    if (inFlightPending(ctx)) {
      await settleOrDeadlock(ctx);
      continue;
    }
    if (ctx.heap.length > 0 && ctx.heap[0]!.at > ctx.clock.now()) {
      advanceToNextDue(ctx.heap, ctx.clock);
    }
  }
}

export async function runUntilPred(args: {
  readonly ctx: DrainContext;
  readonly pred: () => boolean | Promise<boolean>;
  readonly opts?: {
    readonly maxVirtualMs?: number;
    readonly maxSteps?: number;
  };
}): Promise<boolean> {
  const { ctx, pred, opts } = args;
  if (await pred()) return true;
  const maxSteps = opts?.maxSteps ?? 100_000;
  const maxVirtualMs = opts?.maxVirtualMs ?? 86_400_000;
  const start = ctx.clock.now();
  let steps = 0;
  while (ctx.heap.length > 0 || inFlightPending(ctx)) {
    if (
      !withinRunUntilBudget({
        steps,
        maxSteps,
        clock: ctx.clock,
        start,
        maxVirtualMs,
      })
    ) {
      return false;
    }
    steps += await fireDueTasks(ctx);
    if (await pred()) return true;
    if (inFlightPending(ctx)) {
      await settleOrDeadlock(ctx);
      if (await pred()) return true;
      continue;
    }
    if (ctx.heap.length === 0) return await pred();
    if (ctx.heap[0]!.at > ctx.clock.now()) {
      advanceToNextDue(ctx.heap, ctx.clock);
    }
  }
  return await pred();
}
