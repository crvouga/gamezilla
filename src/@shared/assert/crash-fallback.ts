export function crashFallback(
  message: string,
  context?: Record<string, unknown>
) {
  throw { __assertion_failure: true, message, context };
}
