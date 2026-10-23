import type {
  ModelParameters,
  QuintBinding,
} from '@pkgs/quint-shared-ts/registry';
import { modelParameterId } from './model-parameters';

type Regression = NonNullable<QuintBinding<unknown>['regressions']>[number];

function validateScope(
  regression: Regression,
  parameters: ModelParameters
): void {
  const scope = regression.parameters;
  if (scope === undefined) return;
  const names = Object.keys(parameters).sort();
  if (
    scope === null ||
    typeof scope !== 'object' ||
    Array.isArray(scope) ||
    Object.keys(scope).length !== names.length ||
    names.some((name) => !Object.hasOwn(scope, name)) ||
    Object.values(scope).some((value) => typeof value !== 'boolean')
  )
    throw new Error(
      `Regression ${regression.id}: parameters must assign exactly the model's Boolean inputs`
    );
}

/** A scoped pin must name a real complete case, never silently disappear. */
export function validateRegressionScopes(
  regressions: readonly Regression[] | undefined,
  assignments: readonly ModelParameters[]
): void {
  const first = assignments[0];
  if (first === undefined)
    throw new Error('Cannot scope an empty model matrix');
  const cases = new Set(assignments.map(modelParameterId));
  for (const regression of regressions ?? []) {
    validateScope(regression, first);
    if (
      regression.parameters !== undefined &&
      !cases.has(modelParameterId(regression.parameters))
    )
      throw new Error(
        `Regression ${regression.id}: no registered model case matches its parameters`
      );
  }
}

/** Planning and execution select the same pins in their original order. */
export function bindingForParameters<W>(
  binding: QuintBinding<W>,
  parameters: ModelParameters
): QuintBinding<W> {
  if (binding.regressions === undefined) return binding;
  const id = modelParameterId(parameters);
  return {
    ...binding,
    regressions: binding.regressions.filter((regression) => {
      validateScope(regression, parameters);
      return (
        regression.parameters === undefined ||
        modelParameterId(regression.parameters) === id
      );
    }),
  };
}
