import { partition, restoreActorConnection } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  createSpace,
  endSpace,
  openSpaceLink,
  openSpacesTab,
} from '@libs/spaces-harness/space-actions';
import { spaceLinkView } from '@libs/spaces-harness/space-link-ui-reads';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const LINK = 'space-link';

function spaceLink(w: QuintHarnessWorld): string {
  const link = w.memo.get(LINK);
  if (typeof link !== 'string') throw new Error('No space link recorded');
  return link;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-links',
  traces: 16,
  maxSteps: 12,
  inductiveInvariant: '_inductive',
  actions: {
    init: async (w, picks) => {
      if (picks['destination'] === 'not found') {
        w.memo.set(LINK, '/space/no-such-space');
      } else {
        await w.s.apply(createSpace, 'alice');
        const link = await w.s.read(readSpaceLink, 'alice');
        if (link === null) throw new Error('Alice opened no space');
        w.memo.set(LINK, link);
        if (picks['destination'] === 'ended')
          await w.s.apply(endSpace, 'alice');
      }
      await w.s.apply(openSpacesTab, 'bob');
    },
    openSpaceLink: async (w) => {
      await w.s.apply(openSpaceLink, 'bob', spaceLink(w));
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, String(picks['person']));
      await w.s.advanceTime(2_000);
    },
  },
  observe: (w) => w.quiet.read(spaceLinkView, 'bob'),
});
