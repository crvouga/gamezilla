const MAX_STRING_PREVIEW = 40;

function previewArg(arg: unknown): string {
  if (typeof arg === 'string') {
    const text =
      arg.length > MAX_STRING_PREVIEW
        ? `${arg.slice(0, MAX_STRING_PREVIEW - 1)}…`
        : arg;
    return JSON.stringify(text);
  }
  if (
    typeof arg === 'number' ||
    typeof arg === 'boolean' ||
    typeof arg === 'bigint'
  ) {
    return String(arg);
  }
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (Array.isArray(arg)) return `[${String(arg.length)} items]`;
  return '{…}';
}

/** Default `apply` step title: `name(arg, …)` with primitive previews. */
export function formatApplyTitle(
  action: string,
  applyArgs: readonly unknown[]
): string {
  if (applyArgs.length === 0) return action;
  return `${action}(${applyArgs.map(previewArg).join(', ')})`;
}

/**
 * Best-effort actor label for an apply step: an `actorId` field on a single
 * object arg, else a leading string arg.
 */
export function actorIdFromArgs(
  applyArgs: readonly unknown[]
): string | undefined {
  if (applyArgs.length === 1) {
    const op = applyArgs[0];
    if (
      typeof op === 'object' &&
      op !== null &&
      'actorId' in op &&
      typeof (op as { actorId: unknown }).actorId === 'string'
    ) {
      return (op as { actorId: string }).actorId;
    }
  }
  if (typeof applyArgs[0] === 'string') return applyArgs[0];
  return undefined;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function errorStack(e: unknown): string | undefined {
  return e instanceof Error && typeof e.stack === 'string'
    ? e.stack
    : undefined;
}
