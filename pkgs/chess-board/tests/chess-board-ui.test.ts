/**
 * Chess board UI suite, in-process: Solid in happy-dom via
 * `@pkgs/ui-testing-solid-dom`. The same suite runs in a real browser engine
 * through `Bun.WebView` in `e2e/` (`bun run test:e2e`).
 */

import { createDomHost } from './ui/hosts/dom-host';
import { defineChessBoardSuite } from './ui/suite/define-chess-board-suite';

defineChessBoardSuite(createDomHost());
