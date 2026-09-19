/**
 * The chess board UI suite, written once against a {@link ChessBoardHost}.
 * Each host (happy-dom in-process, a real browser through `Bun.WebView`)
 * calls this from its own test file so the same scenarios run on both.
 */

import { afterEach, describe } from 'bun:test';

import type { ChessBoardHost } from './board-host';
import { defineAnnotationScenarios } from './scenarios/annotations';
import { defineKeyboardScenarios } from './scenarios/keyboard';
import { defineLifecycleScenarios } from './scenarios/lifecycle';
import { defineModelBasedScenarios } from './scenarios/model-based';
import { defineMoveScenarios } from './scenarios/moves';
import { defineParentSyncScenarios } from './scenarios/parent-sync';
import { definePremoveScenarios } from './scenarios/premoves';
import { defineRenderingScenarios } from './scenarios/rendering';
import { defineSpecialMoveScenarios } from './scenarios/special-moves';
import { defineUserShapeScenarios } from './scenarios/user-shapes';

export function defineChessBoardSuite(host: ChessBoardHost): void {
  describe(`chess board [${host.name}]`, () => {
    afterEach(async () => {
      await host.close();
    });
    defineRenderingScenarios(host);
    defineMoveScenarios(host);
    defineSpecialMoveScenarios(host);
    defineParentSyncScenarios(host);
    definePremoveScenarios(host);
    defineKeyboardScenarios(host);
    defineAnnotationScenarios(host);
    defineUserShapeScenarios(host);
    defineLifecycleScenarios(host);
    defineModelBasedScenarios(host);
  });
}
