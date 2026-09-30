import { ATTR } from './attributes';

const PLACE_LIMIT = 64;

/**
 * Where a connection appeared, taken from the edge (Cloudflare `request.cf`).
 * The person's own clock is separate: a connection can appear in another city
 * while their clock stays where they are.
 */
export function connectionAttributes(
  facts: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, string>> {
  if (facts === undefined) return {};
  const city = placeText(facts['city']);
  const region = placeText(facts['region']);
  const country = placeText(facts['country']);
  const timeZone = placeText(facts['timezone']);
  return {
    ...(city === undefined ? {} : { [ATTR.APP_CLIENT_CITY]: city }),
    ...(region === undefined ? {} : { [ATTR.APP_CLIENT_REGION]: region }),
    ...(country === undefined ? {} : { [ATTR.APP_CLIENT_COUNTRY]: country }),
    ...(timeZone === undefined
      ? {}
      : { [ATTR.APP_CLIENT_TIMEZONE]: timeZone }),
  };
}

function placeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length <= PLACE_LIMIT ? trimmed : trimmed.slice(0, PLACE_LIMIT);
}
