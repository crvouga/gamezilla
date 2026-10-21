import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_ROUTE_GROUP,
  explicitRouteGroup,
  INTERACTIVE_ROUTE_GROUPS,
  PEOPLE_ROUTE_GROUPS,
  ROUTE_GROUPS,
  ROUTE_RULES,
  routeGroupOf,
} from '@libs/observability-shared/route-groups';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

describe('the group a route belongs to', () => {
  test.each([
    ['/api/query', 'sync'],
    ['/api/mutations', 'sync'],
    ['/api/auth/*', 'session'],
    ['/api/auth/synthetic-monitor/code', 'session'],
    ['/api/identity/anon/ensure', 'session'],
    ['/api/pubsub/token', 'session'],
    ['/api/room', 'room'],
    ['/api/billing/callback/:provider', 'billing'],
    ['/api/tts/audio/:hashWithExt', 'media'],
    ['/api/llm/structured', 'media'],
    ['/api/notifications/notifications/:id/read', 'app'],
    ['/api/observability/v1/:signal', 'telemetry'],
    ['/api/health', 'machine'],
    ['/api/health/ready', 'machine'],
    ['/api/synthetic-population-worker/claim', 'machine'],
  ] as const)('%s is %s', (route, group) => {
    expect(explicitRouteGroup(route)).toBe(group);
    expect(routeGroupOf(route)).toBe(group);
  });

  test('is the people default for a route no rule names', () => {
    expect(explicitRouteGroup('/api/something-new/:id')).toBeNull();
    expect(routeGroupOf('/api/something-new/:id')).toBe(DEFAULT_ROUTE_GROUP);
    expect(routeGroupOf('/api/*')).toBe('app');
    expect(PEOPLE_ROUTE_GROUPS as readonly string[]).toContain(
      DEFAULT_ROUTE_GROUP
    );
    expect(INTERACTIVE_ROUTE_GROUPS as readonly string[]).toContain(
      DEFAULT_ROUTE_GROUP
    );
  });

  test('matches whole path segments only', () => {
    expect(explicitRouteGroup('/api/roomy')).toBeNull();
    expect(explicitRouteGroup('/api/healthcheck')).toBeNull();
    expect(explicitRouteGroup('/api/queryable')).toBeNull();
  });

  test('is always one of the closed list, whatever the pattern', () => {
    assertProperty(
      'route group is in the vocabulary',
      fc.property(fc.string(), (route) => {
        expect(ROUTE_GROUPS).toContain(routeGroupOf(route));
      })
    );
  });

  test('prefers the longest rule', () => {
    assertProperty(
      'a deeper path keeps its family group',
      fc.property(
        fc.constantFrom(...ROUTE_RULES),
        fc.array(fc.stringMatching(/^[a-z:]{1,8}$/), { maxLength: 3 }),
        (rule, rest) => {
          const route = [rule.prefix, ...rest].join('/');
          const longer = ROUTE_RULES.filter(
            (other) =>
              other.prefix.length > rule.prefix.length &&
              route.startsWith(`${other.prefix}/`)
          );
          fc.pre(longer.length === 0);
          expect(routeGroupOf(route)).toBe(rule.group);
        }
      )
    );
  });
});

describe('the vocabulary', () => {
  test('keeps machines and uploads out of what people experience', () => {
    for (const machine of ['machine', 'telemetry'] as const) {
      expect(PEOPLE_ROUTE_GROUPS as readonly string[]).not.toContain(machine);
    }
  });

  test('judges speed only for requests people wait on at once', () => {
    expect(INTERACTIVE_ROUTE_GROUPS as readonly string[]).not.toContain(
      'media'
    );
    for (const group of INTERACTIVE_ROUTE_GROUPS) {
      expect(PEOPLE_ROUTE_GROUPS as readonly string[]).toContain(group);
    }
  });

  test('has one rule per family, each under the API prefix, naming a real group', () => {
    const prefixes = ROUTE_RULES.map((rule) => rule.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const rule of ROUTE_RULES) {
      expect(rule.prefix.startsWith('/api/')).toBe(true);
      expect(ROUTE_GROUPS).toContain(rule.group);
    }
  });

  test('fits the series budget of the request metrics', () => {
    expect(ROUTE_GROUPS.length).toBeLessThanOrEqual(8);
  });
});
