import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';

export function splitPlace(place: string): {
  readonly city: string;
  readonly region?: string;
} {
  const parts = place
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const city = parts[0] ?? '';
  const region = parts[1];
  return region === undefined ? { city } : { city, region };
}

/** A place matches when any word of it is the recorded city, region, or country. */
export function placeMatches(asked: string, recorded: string): boolean {
  const want = tokens(asked);
  const have = new Set(tokens(recorded));
  if (want.length === 0 || have.size === 0) return false;
  return want.some((token) => have.has(token));
}

/**
 * 2 when the asked city itself was recorded, 1 when only a region or country
 * word matches, 0 otherwise. A city hit wins over a region-only hit.
 */
export function placeFit(asked: string, recorded: string): 0 | 1 | 2 {
  if (!placeMatches(asked, recorded)) return 0;
  const city = new Set(tokens(splitPlace(asked).city));
  const recordedCity = new Set(tokens(recorded.split(',')[0] ?? ''));
  for (const token of city) {
    if (recordedCity.has(token)) return 2;
  }
  return 1;
}

export function recordedPlace(
  attributes: NarrateSpan['attributes']
): string | undefined {
  const parts = [
    text(attributes[ATTR.APP_CLIENT_CITY]),
    text(attributes[ATTR.APP_CLIENT_REGION]),
    text(attributes[ATTR.APP_CLIENT_COUNTRY]),
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(', ');
}

export function recordedDeviceTimeZone(
  attributes: NarrateSpan['attributes']
): string | undefined {
  return text(attributes[ATTR.APP_DEVICE_TIMEZONE]);
}

function text(value: NarrateSpan['attributes'][string]): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}
