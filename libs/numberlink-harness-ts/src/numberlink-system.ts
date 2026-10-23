import { applyNumberlinkAction } from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSnapshot } from '@pkgs/harness-root-shared-ts/define-snapshot';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';
import { numberedCells, numberlinkFixture } from './numberlink-fixtures';

export type NumberlinkHarness = {
  definition: NumberlinkDefinition;
  state: NumberlinkState;
  original: string;
  before: string;
  refusal: string | null;
};

export const openNumberlink = defineAction({
  name: 'openNumberlink',
  act: (s: NumberlinkHarness, name: string) => {
    s.definition = numberlinkFixture(name);
    s.original = JSON.stringify(s.definition);
    s.state = { paths: [] };
    s.before = JSON.stringify(s.state);
    s.refusal = null;
  },
});

function draw(s: NumberlinkHarness, label: string, text: string): void {
  s.before = JSON.stringify(s.state);
  const pairId =
    s.definition.pairs.find((pair) => pair.label === label)?.id ?? 'missing';
  const result = applyNumberlinkAction(s.definition, s.state, {
    pairId,
    cells: numberedCells(text),
  });
  s.refusal = result.valid ? null : result.issues[0]!.code;
  if (result.valid) s.state = result.value;
}

export const drawNumberlinkPath = defineAction({
  name: 'drawNumberlinkPath',
  act: draw,
});

export const arrangeNumberlinkPath = defineAction({
  name: 'arrangeNumberlinkPath',
  act: (s: NumberlinkHarness, label: string, text: string) => {
    draw(s, label, text);
    if (s.refusal !== null)
      throw new Error(`Invalid Numberlink setup: ${s.refusal}`);
  },
});

export const removeNumberlinkPath = defineAction({
  name: 'removeNumberlinkPath',
  act: (s: NumberlinkHarness, label: string) => draw(s, label, ''),
});

export const clearNumberlink = defineAction({
  name: 'clearNumberlink',
  act: (s: NumberlinkHarness) => {
    s.before = JSON.stringify(s.state);
    s.state = { paths: [] };
    s.refusal = null;
  },
});

export const numberlinkSystem = defineSystem<NumberlinkHarness>({
  name: 'numberlink',
  create: () => {
    const definition = numberlinkFixture('Two rows');
    return {
      definition,
      state: { paths: [] },
      original: JSON.stringify(definition),
      before: '',
      refusal: null,
    };
  },
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [
    openNumberlink,
    drawNumberlinkPath,
    arrangeNumberlinkPath,
    removeNumberlinkPath,
    clearNumberlink,
  ],
  snapshots: [
    defineSnapshot({
      name: 'drawing',
      capture: (s: NumberlinkHarness) => ({
        definition: s.definition,
        state: s.state,
        refusal: s.refusal,
      }),
    }),
  ],
});
