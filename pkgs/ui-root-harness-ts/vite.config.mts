// @io-wall-ok — Storybook build composition root

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getConfig } from '@lingui/conf';
import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vite';

// The framework detects Solid in this base config before it adds its default compiler.
// Lingui must see the original JSX before Solid lowers component references.
export default defineConfig({
  plugins: [
    solid({
      babel: {
        plugins: [
          [
            createRequire(import.meta.url).resolve(
              '@lingui/babel-plugin-lingui-macro'
            ),
            {
              descriptorFields: 'all',
              linguiConfig: getConfig({
                configPath: resolve(
                  import.meta.dirname,
                  '../../lingui.solid.config.ts'
                ),
              }),
            },
          ],
        ],
      },
    }),
  ],
});
