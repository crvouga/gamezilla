import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { decodeNumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-definition';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { P } from '@pkgs/ui-root-client-ts/text';
import { NumberlinkEditor } from './numberlink-editor';
import { initialNumberlinkDefinition } from './numberlink-editor-actions';
import { NumberlinkPlayer, NumberlinkPreview } from './numberlink-player';

export const numberlinkGameClient = defineGameClient({
  shared: numberlinkGameShared,
  title: 'Numberlink',
  caption: 'Connect matching endpoints',
  tile: 'paths',
  subtitle: () => <Trans>Connect each matching pair and fill the board.</Trans>,
  instructions: () => (
    <P>
      <Trans>
        Join matching endpoints with paths that move horizontally or vertically.
        Paths never cross or overlap. Cover every cell unless the puzzle
        explicitly uses pairs-only coverage.
      </Trans>
    </P>
  ),
  puzzleContent: {
    Player: NumberlinkPlayer,
    Preview: NumberlinkPreview,
    frame: {
      stats: {
        connectedPairs: () => t`Connected pairs`,
        coveredCells: () => t`Covered cells`,
      },
      // Pairs out of every pair; cells out of the board's, when the puzzle
      // asks for every cell to be covered.
      totals: (definition) => {
        const board = decodeNumberlinkDefinition(definition);
        if (!board.valid) return {};
        const pairs = board.value.pairs.length;
        return board.value.coverage === 'all'
          ? {
              connectedPairs: pairs,
              coveredCells: board.value.width * board.value.height,
            }
          : { connectedPairs: pairs };
      },
      turnStatus: () => null,
    },
    authoring: {
      Editor: NumberlinkEditor,
      initialDefinition: initialNumberlinkDefinition,
    },
  },
});
