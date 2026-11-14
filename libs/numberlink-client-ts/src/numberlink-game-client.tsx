import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { decodeNumberlinkDraft } from '@libs/numberlink-shared-ts/numberlink-definition';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import { Trans } from '@lingui/solid/macro';
import { numberlinkContentFrame } from './numberlink-content-frame';
import { NumberlinkEditor } from './numberlink-editor';
import { initialNumberlinkDefinition } from './numberlink-editor-actions';
import { NumberlinkPlayer, NumberlinkPreview } from './numberlink-player';

export const numberlinkGameClient = defineGameClient({
  shared: numberlinkGameShared,
  title: 'Numberlink',
  caption: 'Connect matching endpoints',
  tile: 'paths',
  subtitle: () => <Trans>Connect each matching pair and fill the board.</Trans>,
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => (
        <Trans>
          Join every pair of matching endpoints, and cover every cell unless the
          puzzle explicitly uses pairs-only coverage.
        </Trans>
      ),
    },
    {
      key: 'paths',
      title: () => <Trans>Paths</Trans>,
      body: () => (
        <Trans>
          Paths move horizontally or vertically. They never cross or overlap.
        </Trans>
      ),
    },
  ],
  puzzleContent: {
    Player: NumberlinkPlayer,
    Preview: NumberlinkPreview,
    frame: numberlinkContentFrame,
    authoring: {
      Editor: NumberlinkEditor,
      initialDefinition: initialNumberlinkDefinition,
      readable: (definition) => decodeNumberlinkDraft(definition).valid,
    },
  },
});
