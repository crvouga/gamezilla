import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { decodeNumberlinkDraft } from '@libs/numberlink-shared-ts/numberlink-definition';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { numberlinkContentFrame } from './numberlink-content-frame';
import { NumberlinkEditor } from './numberlink-editor';
import { initialNumberlinkDefinition } from './numberlink-editor-actions';
import { numberlinkLesson } from './numberlink-lesson';
import {
  NumberlinkPlayer,
  NumberlinkPreview,
  NumberlinkSupport,
} from './numberlink-player';

export const numberlinkGameClient = defineGameClient({
  shared: numberlinkGameShared,
  title: 'Numberlink',
  caption: 'Connect matching endpoints',
  tile: 'paths',
  subtitle: () => <Trans>Connect each matching pair and fill the board.</Trans>,
  lesson: numberlinkLesson,
  puzzleContent: {
    Player: NumberlinkPlayer,
    Support: NumberlinkSupport,
    Preview: NumberlinkPreview,
    frame: numberlinkContentFrame,
    authoring: {
      Editor: NumberlinkEditor,
      initialDefinition: initialNumberlinkDefinition,
      readable: (definition) => decodeNumberlinkDraft(definition).valid,
    },
  },
});
