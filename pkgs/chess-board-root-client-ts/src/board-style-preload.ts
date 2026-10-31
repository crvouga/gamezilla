// @io-wall-ok — package test composition: load the board's actual stylesheet.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileCssModule } from '@pkgs/bun-test-solid-client-ts/css-module';

// Use the DOM preload's isolated CSS-module names. Keep one real stylesheet
// for this test process, like a browser's stylesheet, rather than inventing
// computed values in observers or attaching styles to each mounted board.
const stylesheet = document.createElement('style');
const path = fileURLToPath(
  new URL('./chess-board/chess-board.module.css', import.meta.url)
);
stylesheet.textContent = compileCssModule(path, readFileSync(path, 'utf8')).css;
document.head.append(stylesheet);
