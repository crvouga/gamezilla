import { describe, expect, test } from 'bun:test';
import type { ObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';
import {
  failureId,
  failureMessage,
  failureWhere,
  isObjectiveFailure,
} from '@pkgs/openslo-shared-ts/failure';

const SPEC = 'specs/runtime/request-success.openslo.yaml';

const missed: ObjectiveFailure = {
  environment: 'prd',
  specUri: SPEC,
  slo: 'the-app-serves-people',
  sloDisplayName: 'The app serves people',
  sloDescription: null,
  check: { kind: 'objective', objective: 'At least 99.99% meet this promise' },
  window: '28d',
  target: 0.9999,
  observed: 0.995548,
  considered: 12_357,
  readings: [],
  budgetRemaining: null,
  response: {
    owner: 'runtime',
    runbook:
      'https://github.com/crvouga/gamezilla/blob/main/docs/SLO_RUNBOOK.md#the-app-serves-people',
    command: 'bun obs errors --since 1d --source prod --env prd',
  },
  detail:
    'observed 0.995548 (12302/12357 good events) vs target 0.9999; 12357 considered',
};

// regression: objective-failures-unnamed-environment
describe('a failure message', () => {
  test('a missed objective names the environment, the file, and who answers it how', () => {
    expect(failureMessage(missed)).toBe(
      '[prd] specs/runtime/request-success.openslo.yaml: the-app-serves-people does not meet "At least 99.99% meet this promise": observed 0.995548 (12302/12357 good events) vs target 0.9999; 12357 considered. Owner: runtime. Runbook: https://github.com/crvouga/gamezilla/blob/main/docs/SLO_RUNBOOK.md#the-app-serves-people. Investigate with: bun obs errors --since 1d --source prod --env prd'
    );
  });

  test('a firing alert keeps its own words behind where it fired', () => {
    const firing: ObjectiveFailure = {
      ...missed,
      environment: 'dev',
      check: {
        kind: 'alert',
        policy: 'the-app-serves-people-daily-burn',
        severity: 'ticket',
      },
      detail:
        'TICKET the-app-serves-people (the-app-serves-people-daily-burn) is firing: 12x over 6h',
    };
    expect(failureMessage(firing)).toBe(
      '[dev] specs/runtime/request-success.openslo.yaml: TICKET the-app-serves-people (the-app-serves-people-daily-burn) is firing: 12x over 6h'
    );
    expect(failureId(firing)).toBe(
      'alert:the-app-serves-people:the-app-serves-people-daily-burn'
    );
  });

  test('without an environment the file still says where', () => {
    expect(failureWhere(null, SPEC)).toBe(SPEC);
    expect(failureWhere('', SPEC)).toBe(SPEC);
    expect(
      failureMessage({ ...missed, environment: null, response: null })
    ).toBe(
      'specs/runtime/request-success.openslo.yaml: the-app-serves-people does not meet "At least 99.99% meet this promise": observed 0.995548 (12302/12357 good events) vs target 0.9999; 12357 considered.'
    );
  });

  test('records read back only when well formed', () => {
    expect(isObjectiveFailure(JSON.parse(JSON.stringify(missed)))).toBe(true);
    expect(isObjectiveFailure({ ...missed, check: { kind: 'other' } })).toBe(
      false
    );
    expect(isObjectiveFailure(null)).toBe(false);
  });
});
