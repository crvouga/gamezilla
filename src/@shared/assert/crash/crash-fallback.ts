const UNCATCHABLE_ERROR = { __assertion_failure: true };

export function crashFallback(
  message: string,
  context?: Record<string, unknown>
) {
  throw { ...UNCATCHABLE_ERROR, message, context };
}
