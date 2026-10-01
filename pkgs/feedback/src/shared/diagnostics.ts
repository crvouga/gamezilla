import type { Timers } from '@pkgs/clock';
import type { Diagnostic, DiagnosticProvider } from './types';

const MAX_DIAGNOSTIC_BYTES = 64_000;

/** Freeze optional values into bounded JSON; getters, cycles and BigInt may fail. */
function normalize(value: unknown): unknown {
  const json = JSON.stringify(value) as string | undefined;
  if (json === undefined) throw new Error('No diagnostic value');
  if (new TextEncoder().encode(json).byteLength > MAX_DIAGNOSTIC_BYTES)
    throw new Error('Diagnostic too large');
  return JSON.parse(json);
}

export function collectDiagnostic(
  provider: DiagnosticProvider,
  timers: Timers,
  deadlineMs: number
): Promise<Diagnostic> {
  let name = 'unknown diagnostic';
  try {
    name = provider.name.slice(0, 80);
  } catch {
    /* optional provider metadata */
  }
  return new Promise((resolve) => {
    const controller = new AbortController();
    let complete = false;
    let handle: unknown;
    const finish = (diagnostic: Diagnostic): void => {
      if (complete) return;
      complete = true;
      try {
        timers.clearTimeout(handle);
      } catch {
        /* optional timer cleanup */
      }
      resolve(diagnostic);
    };
    const unavailable = (reason: string): void =>
      finish({ name, status: 'unavailable', reason });
    try {
      handle = timers.setTimeout(() => {
        unavailable('Timed out');
        controller.abort();
      }, deadlineMs);
    } catch {
      unavailable('Deadline unavailable');
      return;
    }
    void Promise.resolve()
      .then(() => provider.collect(controller.signal))
      .then(
        (value) => {
          try {
            finish({
              name,
              status: 'available',
              value: normalize(value),
            });
          } catch {
            unavailable('Could not serialize diagnostic');
          }
        },
        () => unavailable('Could not collect diagnostic')
      );
  });
}

/** Keep optional context within the request budget, including Unicode expansion. */
export async function collectDiagnostics(
  providers: readonly DiagnosticProvider[],
  timers: Timers,
  deadlineMs: number,
  budgetBytes = 64_000
): Promise<readonly Diagnostic[]> {
  try {
    const diagnostics = await Promise.all(
      providers
        .slice(0, 20)
        .map((provider) => collectDiagnostic(provider, timers, deadlineMs))
    );
    let remaining = budgetBytes;
    return diagnostics.map((diagnostic) => {
      const size = new TextEncoder().encode(
        JSON.stringify(diagnostic)
      ).byteLength;
      if (size > remaining)
        return {
          name: diagnostic.name,
          status: 'unavailable' as const,
          reason: 'Diagnostic budget exceeded',
        };
      remaining -= size;
      return diagnostic;
    });
  } catch {
    return [
      {
        name: 'diagnostics',
        status: 'unavailable',
        reason: 'Could not collect diagnostics',
      },
    ];
  }
}
