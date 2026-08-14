import { describe, expect, test } from 'bun:test';

import {
  breadcrumbPatchForBucket,
  breadcrumbPatchForRun,
  breadcrumbPatchForTest,
} from './nav-breadcrumb-patches';

describe('breadcrumb nav patches', () => {
  test('bucket change clears run and player state', () => {
    expect(breadcrumbPatchForBucket('local')).toEqual({
      bucketId: 'local',
      runId: null,
      testId: null,
      frame: null,
      node: null,
      view: null,
    });
  });

  test('bucket clear goes home', () => {
    expect(breadcrumbPatchForBucket(null)).toEqual({
      bucketId: null,
      runId: null,
      testId: null,
      frame: null,
      node: null,
      view: null,
    });
  });

  test('run change clears test and player state', () => {
    expect(breadcrumbPatchForRun('20260812T120000')).toEqual({
      runId: '20260812T120000',
      testId: null,
      frame: null,
      node: null,
      view: null,
    });
  });

  test('run clear keeps bucket path', () => {
    expect(breadcrumbPatchForRun(null)).toEqual({
      runId: null,
      testId: null,
      frame: null,
      node: null,
      view: null,
    });
  });

  test('test change clears frame/node/view', () => {
    expect(breadcrumbPatchForTest('profile-guest-avatar')).toEqual({
      testId: 'profile-guest-avatar',
      frame: null,
      node: null,
      view: null,
    });
  });

  test('test clear returns to suite', () => {
    expect(breadcrumbPatchForTest(null)).toEqual({
      testId: null,
      frame: null,
      node: null,
      view: null,
    });
  });
});
