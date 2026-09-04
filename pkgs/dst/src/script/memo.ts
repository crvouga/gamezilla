import { fingerprint } from '../kernel/fingerprint';

type MemoFrame = {
  readonly cache: Map<string, unknown>;
};

const stack: MemoFrame[] = [];
const fnIds = new WeakMap<object, number>();
let nextFnId = 1;

function idOf(fn: object): number {
  let id = fnIds.get(fn);
  if (id === undefined) {
    id = nextFnId++;
    fnIds.set(fn, id);
  }
  return id;
}

function keyOf(fn: object, args: readonly unknown[]): string {
  return `${String(idOf(fn))}:${fingerprint(args as never)}`;
}

/** Push a memo frame for one probe / checkpoint. */
export function pushMemoFrame(): void {
  stack.push({ cache: new Map() });
}

export function popMemoFrame(): void {
  stack.pop();
}

/**
 * Call a read through the current memo frame (if any).
 * Outside a frame, calls live with no caching.
 */
export async function memoRead<A extends unknown[], T>(
  fn: (s: never, ...args: A) => T | Promise<T>,
  surface: unknown,
  args: A
): Promise<T> {
  const frame = stack[stack.length - 1];
  if (frame === undefined) {
    return (await fn(surface as never, ...args)) as T;
  }
  const k = keyOf(fn as object, args);
  if (frame.cache.has(k)) return frame.cache.get(k) as T;
  const value = (await fn(surface as never, ...args)) as T;
  frame.cache.set(k, value);
  return value;
}

/** Snapshot of memo keys → values for transition coverage (JSON-ish). */
export function snapshotMemo(): Record<string, unknown> {
  const frame = stack[stack.length - 1];
  if (frame === undefined) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of frame.cache) out[k] = v;
  return out;
}
