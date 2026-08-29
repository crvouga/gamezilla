import { assertSnakeCaseIdent } from './snake-case';
import type { DeclaredEnum } from './types';

export type EnumDefInput = {
  readonly domain: string;
  readonly name: string;
  readonly values: readonly string[];
  readonly postgres?: { readonly nativeEnum?: boolean };
  /** Mark the enum deprecated (tombstone; client may drop CHECK). */
  readonly deprecated?: string;
};

export type EnumDef = {
  readonly kind: 'enum';
  readonly domain: string;
  readonly name: string;
  readonly _enum: DeclaredEnum;
  readonly deprecatedNote?: string;
};

function assertMatchesDomain(name: string, domain: string, path: string): void {
  assertSnakeCaseIdent(domain, `${path}.domain`);
  if (name !== domain && !name.startsWith(`${domain}_`)) {
    throw new Error(
      `${path}: name '${name}' must equal domain '${domain}' or start with '${domain}_'`
    );
  }
}

export function defineEnum(input: EnumDefInput): EnumDef {
  const path = `defineEnum(${input.name})`;
  assertSnakeCaseIdent(input.name, `${path}.name`);
  assertMatchesDomain(input.name, input.domain, path);
  if (!Array.isArray(input.values) || input.values.length === 0) {
    throw new Error(`${path}: values must be a non-empty array`);
  }
  const seen = new Set<string>();
  for (let i = 0; i < input.values.length; i++) {
    const v = input.values[i]!;
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`${path}.values[${i}]: must be a non-empty string`);
    }
    if (seen.has(v)) {
      throw new Error(`${path}.values[${i}]: duplicate value '${v}'`);
    }
    seen.add(v);
  }
  if (input.deprecated !== undefined && input.deprecated.length === 0) {
    throw new Error(`${path}: deprecated note must be non-empty`);
  }
  return Object.freeze({
    kind: 'enum' as const,
    domain: input.domain,
    name: input.name,
    _enum: Object.freeze({
      domain: input.domain,
      name: input.name,
      values: Object.freeze([...input.values]),
      ...(input.postgres?.nativeEnum === true ? { nativePostgres: true } : {}),
    }),
    ...(input.deprecated !== undefined
      ? { deprecatedNote: input.deprecated }
      : {}),
  });
}
