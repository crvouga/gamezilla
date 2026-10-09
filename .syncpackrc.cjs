'use strict';

/** @type {import('syncpack').RcFile} */
module.exports = {
  sortAz: ['dependencies', 'devDependencies', 'peerDependencies'],
  versionGroups: [
    {
      label: 'Ignore vendored Kenney cache packages',
      packages: ['site'],
      isIgnored: true,
    },
    {
      label: 'Ignore packages from the pinned Atlas submodule',
      packages: [
        '@crvouga/atlas',
        '@crvouga/atlas-detox',
        '@crvouga/atlas-playwright',
        '@crvouga/atlas-schema',
        '@crvouga/atlas-visualizer',
        '@crvouga/atlas-vitest',
      ],
      isIgnored: true,
    },
  ],
};
