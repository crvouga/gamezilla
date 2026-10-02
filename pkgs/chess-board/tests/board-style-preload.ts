// @io-wall-ok — package test composition: load the board's actual stylesheet.
import { readFileSync } from 'node:fs';

// bun-test-solid exposes CSS-module names unchanged. Keep one real stylesheet
// for this test process, like a browser's stylesheet, rather than inventing
// computed values in observers or attaching styles to each mounted board.
const stylesheet = document.createElement('style');
stylesheet.textContent = readFileSync(
  new URL('../src/chess-board.module.css', import.meta.url),
  'utf8'
);
document.head.append(stylesheet);
