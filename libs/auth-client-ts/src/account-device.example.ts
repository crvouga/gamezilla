/** Story-only device fixtures shared by the devices screens' stories. */
import type { AccountDeviceView } from './account-device-view';

/** This install: an iPhone with a live session. */
export const PHONE: AccountDeviceView = {
  id: 'a1f0c2d3-0000-4000-8000-000000000001',
  createdAt: '2026-03-04T10:15:00.000Z',
  platform: 'ios',
  osName: 'iOS',
  osVersion: '18.4',
  deviceModelName: 'iPhone 15',
  deviceBrand: 'Apple',
  deviceName: 'Avery’s iPhone',
  appVersion: '2.14.0',
  appBuildNumber: '412',
  userAgent: null,
  firstSeenAt: '2026-03-04T10:15:00.000Z',
  lastSeenAt: '2026-11-02T11:58:00.000Z',
  current: true,
  activeSessions: 1,
  latestSessionExpiresAt: '2026-12-02T11:58:00.000Z',
};

/** Another install: a desktop browser, whose session this device cannot see. */
export const WEB: AccountDeviceView = {
  id: 'b2e1d3c4-0000-4000-8000-000000000002',
  createdAt: '2026-05-20T18:40:00.000Z',
  platform: 'web',
  osName: 'macOS',
  osVersion: '15.1',
  deviceModelName: null,
  deviceBrand: null,
  deviceName: null,
  appVersion: '2.14.0',
  appBuildNumber: null,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  firstSeenAt: '2026-05-20T18:40:00.000Z',
  lastSeenAt: '2026-10-30T21:05:00.000Z',
  current: false,
  activeSessions: 0,
  latestSessionExpiresAt: null,
};

/** An install that reported almost nothing: every value falls back. */
export const TABLET: AccountDeviceView = {
  id: 'c3d2e4f5-0000-4000-8000-000000000003',
  createdAt: '2026-01-11T08:00:00.000Z',
  platform: null,
  osName: null,
  osVersion: null,
  deviceModelName: null,
  deviceBrand: null,
  deviceName: null,
  appVersion: null,
  appBuildNumber: null,
  userAgent: null,
  firstSeenAt: null,
  lastSeenAt: null,
  current: false,
  activeSessions: 0,
  latestSessionExpiresAt: null,
};
