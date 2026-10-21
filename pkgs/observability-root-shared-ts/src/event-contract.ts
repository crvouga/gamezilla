export type AttributeRule = {
  readonly type: 'string' | 'number' | 'boolean';
  readonly required?: boolean;
  readonly values?: readonly string[];
  readonly minimum?: number;
};

export type EventContract = {
  readonly name: string;
  readonly version: number;
  readonly owner: string;
  readonly description: string;
  readonly delivery: 'best_effort' | 'reliable' | 'authoritative';
  readonly attributes: Readonly<Record<string, AttributeRule>>;
};

type RuleValue<R extends AttributeRule> = R['values'] extends readonly string[]
  ? R['values'][number]
  : R['type'] extends 'number'
    ? number
    : R['type'] extends 'boolean'
      ? boolean
      : string;

export type EventPayload<C extends EventContract> = {
  [K in keyof C['attributes'] as C['attributes'][K]['required'] extends true
    ? K
    : never]: RuleValue<C['attributes'][K]>;
} & {
  [K in keyof C['attributes'] as C['attributes'][K]['required'] extends true
    ? never
    : K]?: RuleValue<C['attributes'][K]>;
};

export function defineEvent<const C extends EventContract>(contract: C): C {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(contract.name))
    throw new Error('Event names require a domain, entity and action');
  if (!Number.isSafeInteger(contract.version) || contract.version < 1)
    throw new Error('Event version must be a positive integer');
  if (!/^[a-z][a-z0-9-]*$/.test(contract.owner) || !contract.description)
    throw new Error('Event ownership and description are required');
  if (Object.keys(contract.attributes).length > 28)
    throw new Error('Event attributes exceed the record budget');
  for (const key of Object.keys(contract.attributes)) {
    if (key.startsWith('event.'))
      throw new Error('Event envelope attributes are reserved');
    if (/password|token|secret|email|body|query|chat|card|address/i.test(key))
      throw new Error(`Sensitive telemetry attribute: ${key}`);
  }
  return contract;
}

/** Default deny: undeclared fields fail rather than silently entering storage. */
export function validateEvent(
  contract: EventContract,
  payload: Readonly<Record<string, unknown>>
): boolean {
  if (
    Object.keys(payload).some((key) => !Object.hasOwn(contract.attributes, key))
  )
    return false;
  return Object.entries(contract.attributes).every(([key, rule]) => {
    const value = payload[key];
    if (value === undefined) return rule.required !== true;
    if (typeof value !== rule.type) return false;
    if (typeof value === 'number')
      return Number.isFinite(value) && value >= (rule.minimum ?? -Infinity);
    if (typeof value !== 'string') return true;
    return (
      value.length <= 256 &&
      !/\bBearer\s|@|[?&](?:token|secret|password)=/i.test(value) &&
      (rule.values === undefined || rule.values.includes(value))
    );
  });
}
