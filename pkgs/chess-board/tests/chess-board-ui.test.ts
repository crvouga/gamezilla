/**
 * Chess board UI suite, in-process: Solid in happy-dom via
 * `@pkgs/ui-testing-solid-dom`.
 */

import { createDomHost } from './ui/hosts/dom-host';
import { defineChessBoardSuite } from './ui/suite/define-chess-board-suite';

defineChessBoardSuite(createDomHost());
