import { Assert } from '@pkgs/assert-shared/assert';

/** Turn `@pkgs/assert-shared` crashes into thrown errors for the test runner. */
export function registerTestCrashHandler(): () => void {
  return Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${String(message)} ${JSON.stringify(context)}`
      );
    },
  });
}
