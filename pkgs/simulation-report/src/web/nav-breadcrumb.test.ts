import { describe, expect, test } from 'bun:test';

import {
  breadcrumbPatchForBucket,
  breadcrumbPatchForRun,
  breadcrumbPatchForTest,
} from './nav-breadcrumb';

describe('breadcrumb nav patches', () => {
  test('bucket change clears run and player state', () => {
    expect(breadcrumbPatchForBucket('local')).toEqual({
      bucketId: 'local',
      runId: null,
      testId: null,
      step: null,
      frame: null,
      node: null,
      attr: null,
      play: false,
    });
  });

  test('bucket clear goes home', () => {
    expect(breadcrumbPatchForBucket(null)).toEqual({
      bucketId: null,
      runId: null,
      testId: null,
      step: null,
      frame: null,
      node: null,
      attr: null,
      play: false,
    });
  });

  test('run change clears test and player state', () => {
    expect(breadcrumbPatchForRun('20260812T120000')).toEqual({
      runId: '20260812T120000',
      testId: null,
      step: null,
      frame: null,
      node: null,
      attr: null,
      play: false,
    });
  });

  test('run clear keeps bucket path', () => {
    expect(breadcrumbPatchForRun(null)).toEqual({
      runId: null,
      testId: null,
      step: null,
      frame: null,
      node: null,
      attr: null,
      play: false,
    });
  });

  test('test change clears frame/step/play', () => {
    expect(breadcrumbPatchForTest('profile-guest-avatar')).toEqual({
      testId: 'profile-guest-avatar',
      step: null,
      frame: null,
      node: null,
      attr: null,
      play: false,
    });
  });

  test('test clear returns to suite', () => {
    expect(breadcrumbPatchForTest(null)).toEqual({
      testId: null,
      step: null,
      frame: null,
      node: null,
      attr: null,
      play: false,
    });
  });
});
