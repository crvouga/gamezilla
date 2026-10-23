import { Assert } from '@pkgs/assert-root-shared-ts/assert';

/** Turn `@pkgs/assert-root-shared-ts` crashes into thrown errors for the test runner. */
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
