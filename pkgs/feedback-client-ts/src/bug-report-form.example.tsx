import type { BugReportState } from './controller';

/** A stand-in for a picture of the app: image content, not a color the UI wears. */
const picture = (fill: string, label: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${fill}"/><text x="48" y="54" font-size="14" text-anchor="middle" fill="white">${label}</text></svg>`
  )}`;

/** What the app captured when the bug report opened. */
export const autoScreenshot: BugReportState['screenshots'] = [
  { id: 'auto', url: picture('steelblue', 'Board') },
];

/** As many screenshots as one bug report carries. */
export const fullScreenshots: BugReportState['screenshots'] = [
  ...autoScreenshot,
  { id: 'second', url: picture('slateblue', 'Lobby') },
  { id: 'third', url: picture('seagreen', 'Settings') },
  { id: 'fourth', url: picture('sienna', 'Profile') },
];
