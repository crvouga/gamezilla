import { expect, test } from 'bun:test';
import { cleanupReportObjects } from '@libs/harness-ts/report-retention';
import {
  publishConfiguredReports,
  reportsStoreUnconfigured,
} from '@libs/harness-ts/report-store-configuration';

// regression: retired-reports-nightly-publication
test('CI with a retired reports store does not prepare or transfer report output', async () => {
  const publish = async () => {
    throw new Error('publication must not start without a configured store');
  };
  expect(
    await publishConfiguredReports({ GITHUB_ACTIONS: 'true' }, publish)
  ).toBe(false);
});

test('partial CI report credentials and publication errors still fail', async () => {
  for (const name of [
    'REPORTS_BUCKET',
    'REPORTS_ENDPOINT',
    'REPORTS_WRITE_ACCESS_KEY_ID',
    'REPORTS_WRITE_SECRET_ACCESS_KEY',
  ]) {
    await expect(
      publishConfiguredReports(
        { GITHUB_ACTIONS: 'true', [name]: 'configured' },
        async () => {
          throw new Error('invalid reports configuration');
        }
      )
    ).rejects.toThrow('invalid reports configuration');
  }
  let published = false;
  expect(
    await publishConfiguredReports({ REPORTS_BUCKET: 'reports' }, async () => {
      published = true;
    })
  ).toBe(true);
  expect(published).toBe(true);
});

// regression: retired-reports-cleanup
test('a retired store needs no retention, but every partially configured store still requires validation', () => {
  expect(reportsStoreUnconfigured({ GITHUB_ACTIONS: 'true' })).toBe(true);
  for (const name of [
    'REPORTS_BUCKET',
    'REPORTS_ENDPOINT',
    'REPORTS_WRITE_ACCESS_KEY_ID',
    'REPORTS_WRITE_SECRET_ACCESS_KEY',
  ]) {
    expect(reportsStoreUnconfigured({ [name]: 'configured' })).toBe(false);
    expect(reportsStoreUnconfigured({ [name]: '  ' })).toBe(true);
  }
});

// regression: retired-reports-cleanup
test('retention never opens a retired store and never swallows invalid credentials', async () => {
  const openStore = () => {
    throw new Error('REPORTS_BUCKET is not set');
  };
  for (const apply of [false, true]) {
    expect(
      await cleanupReportObjects({ GITHUB_ACTIONS: 'true' }, apply, openStore)
    ).toBeNull();
    await expect(
      cleanupReportObjects(
        { REPORTS_ENDPOINT: 'https://reports.example' },
        apply,
        openStore
      )
    ).rejects.toThrow('REPORTS_BUCKET is not set');
  }
});
