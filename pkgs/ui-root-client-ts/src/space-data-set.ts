import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';

/**
 * A space control's `data-*` set with its caller's test id, when given
 * (`data-testid`, which ships in every build for harness bindings).
 */
export function spaceDataSet(
  base: ComponentDataSet,
  testId: string | undefined
): ComponentDataSet {
  return testId === undefined ? base : { ...base, testid: testId };
}
