declare const __DEV__: boolean;

function isWdyrEnabled(): boolean {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return false;
  }
  const raw = process.env['EXPO_PUBLIC_WDYR'];
  return raw === '1' || raw === 'true';
}

/**
 * Dev-only why-did-you-render. Opt in with `EXPO_PUBLIC_WDYR=1`.
 * Import this module first from `index.js` so it patches React before the tree.
 */
if (isWdyrEnabled()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- before React tree
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const whyDidYouRender = require('@welldone-software/why-did-you-render') as (
    react: typeof React,
    options: Record<string, unknown>
  ) => void;
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    collapseGroups: true,
  });
}
