import { describe, expect, test } from 'bun:test';
import { tagFilter } from '@pkgs/gherkin/tags';
import { environmentTags } from './health';

function runs(
  env: Parameters<typeof environmentTags>[0],
  tags: readonly string[]
): boolean {
  return tagFilter(environmentTags(env).join(' and '))(tags);
}

const PRODUCTION_RELAY = { production: true, relay: true, observability: true };
const STANDARD = { production: false, relay: false, observability: true };

describe('health environment tags', () => {
  test('a production relay environment runs every scenario', () => {
    expect(environmentTags(PRODUCTION_RELAY)).toEqual([]);
  });

  test('critical journeys and live billing run only in production', () => {
    expect(runs(STANDARD, ['@domain:journeys', '@production'])).toBe(false);
    expect(runs(PRODUCTION_RELAY, ['@domain:journeys', '@production'])).toBe(
      true
    );
    expect(runs(STANDARD, ['@domain:health'])).toBe(true);
  });

  test('relay and observability scenarios follow the environment', () => {
    expect(runs(STANDARD, ['@domain:health', '@oauth-relay'])).toBe(false);
    expect(
      runs({ ...PRODUCTION_RELAY, observability: false }, ['@observability'])
    ).toBe(false);
  });
});
