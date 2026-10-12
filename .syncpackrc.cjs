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
  ],
};
