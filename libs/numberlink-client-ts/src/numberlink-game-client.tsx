import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
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
      turnStatus: () => null,
    },
    authoring: {
      Editor: NumberlinkEditor,
      initialDefinition: initialNumberlinkDefinition,
    },
  },
});
