import { newIdGenerator, parsePhase1fromText } from '@informalsystems/quint';
import type { ModelParameters } from '@pkgs/quint-shared-ts/registry';

type Parameter = {
  readonly name: string;
  readonly start: number;
  readonly end: number;
};

// One model's cases are prepared together. Retain only declaration spans,
// bounded to that exact source and module, rather than reparsing each case.
let lastModel:
  | {
      readonly source: string;
      readonly moduleName: string;
      readonly parameters: readonly Parameter[];
    }
  | undefined;

function parsedModel(source: string, moduleName: string): readonly Parameter[] {
  if (lastModel?.source === source && lastModel.moduleName === moduleName)
    return lastModel.parameters;
  const parsed = parsePhase1fromText(newIdGenerator(), source, moduleName);
  if (parsed.errors.length > 0)
    throw new Error(`${moduleName}: cannot instantiate an invalid Quint model`);
  const module = parsed.modules.find((item) => item.name === moduleName);
  if (module === undefined) throw new Error(`${moduleName}: no main module`);
  const constants = module.declarations.filter((item) => item.kind === 'const');
  const parameters = constants.map((constant) => {
    if (constant.typeAnnotation.kind !== 'bool')
      throw new Error(`${moduleName}: constant ${constant.name} must be bool`);
    const span = parsed.sourceMap.get(constant.id);
    if (span?.end === undefined)
      throw new Error(`${moduleName}: missing constant source span`);
    return {
      name: constant.name,
      start: span.start.index,
      end: span.end.index + 1,
    };
  });
  lastModel = { source, moduleName, parameters };
  return parameters;
}

/** Only the main module's free inputs; imported, already instantiated modules are unchanged. */
export function modelParameterNames(
  source: string,
  module: string
): readonly string[] {
  return parsedModel(source, module)
    .map((item) => item.name)
    .sort();
}

/** Every assignment is a separate proof obligation, including unused consumer shapes. */
export function modelParameterCases(
  source: string,
  module: string
): readonly ModelParameters[] {
  return modelParameterNames(source, module).reduce<ModelParameters[]>(
    (cases, name) =>
      cases.flatMap((values) => [
        { ...values, [name]: false },
        { ...values, [name]: true },
      ]),
    [{}]
  );
}

/** Canonical, readable identity used in trace caches, proof directories and evidence. */
export function modelParameterId(parameters: ModelParameters): string {
  return Object.keys(parameters)
    .sort()
    .map((name) => `${name}=${String(parameters[name])}`)
    .join(',');
}

/**
 * Close bool constants as literal pure values in a private compiler input.
 * This preserves the main module's definitions for induction and temporal
 * planning. Source positions ensure comments and imported module constants
 * cannot be mistaken for the main module's parameters.
 */
export function instantiateModel(
  source: string,
  module: string,
  parameters: ModelParameters
): string {
  const constants = parsedModel(source, module);
  const names = constants.map((item) => item.name).sort();
  if (
    JSON.stringify(Object.keys(parameters).sort()) !== JSON.stringify(names) ||
    names.some((name) => typeof parameters[name] !== 'boolean')
  ) {
    throw new Error(
      `${module}: assign exactly these bool constants: ${names.join(', ') || '(none)'}`
    );
  }
  const edits = constants.map((constant) => {
    return {
      start: constant.start,
      end: constant.end,
      text: `pure val ${constant.name}: bool = ${String(parameters[constant.name])}`,
    };
  });
  for (const edit of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}
