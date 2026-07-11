'use strict';

const ICONS_MODULE_GLOBS = [
  '**/pkgs/ui/src/components/icons/**',
  '**/src/components/icons/**',
];

function lucideRestrictedImportsBlock() {
  return [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'lucide-react-native',
                message:
                  'Import icons from @pkgs/ui (e.g. SearchIcon), not lucide-react-native directly.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ICONS_MODULE_GLOBS,
      rules: { 'no-restricted-imports': 'off' },
    },
  ];
}

module.exports = { lucideRestrictedImportsBlock, ICONS_MODULE_GLOBS };
