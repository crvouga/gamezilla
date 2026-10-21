import type { AttributeRule, EventContract } from './event-contract';

/** A contract version is immutable to consumers. Breaking attribute changes
 * require a larger version, so saved queries can opt in explicitly. */
export function eventCompatibilityErrors(
  previous: EventContract,
  next: EventContract
): readonly string[] {
  const errors: string[] = [];
  if (previous.name !== next.name) errors.push('Event name changed');
  if (previous.owner !== next.owner) errors.push('Event owner changed');
  if (next.version < previous.version) errors.push('Event version decreased');
  if (next.version > previous.version) return errors;
  if (previous.delivery !== next.delivery)
    errors.push('Delivery requirement changed without a new version');
  for (const [key, rule] of Object.entries(previous.attributes))
    errors.push(
      ...attributeCompatibilityErrors(key, rule, next.attributes[key])
    );
  for (const [key, rule] of Object.entries(next.attributes)) {
    if (rule.required === true && previous.attributes[key]?.required !== true)
      errors.push(`Required attribute added: ${key}`);
  }
  return errors;
}

function attributeCompatibilityErrors(
  key: string,
  rule: AttributeRule,
  updated: AttributeRule | undefined
): readonly string[] {
  const errors: string[] = [];
  if (updated === undefined || updated.type !== rule.type) {
    errors.push(`Attribute removed or retyped: ${key}`);
    return errors;
  }
  if (rule.required === true && updated.required !== true)
    errors.push(`Required attribute weakened: ${key}`);
  if ((updated.minimum ?? -Infinity) > (rule.minimum ?? -Infinity))
    errors.push(`Attribute minimum narrowed: ${key}`);
  if (
    updated.values !== undefined &&
    (rule.values === undefined ||
      rule.values.some((value) => !updated.values?.includes(value)))
  )
    errors.push(`Attribute vocabulary narrowed: ${key}`);
  return errors;
}
