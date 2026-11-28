/** @jsxImportSource @solidjs/web */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { MiniPlayerDock } from '@pkgs/ui-root-client-ts/mini-player';
import { ReturnToGame } from '@pkgs/ui-root-client-ts/return-to-game';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function ReturnToGameExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Docked: a game session waits in another space">
        <MiniPlayerDock>
          <ReturnToGame
            title="Your game session is under way"
            caption="Chess · Robin's space"
            action="Return to the game session"
            kind="custom"
            onReturn={() => undefined}
          />
        </MiniPlayerDock>
      </ExampleSection>
      <ExampleSection title="Docked: a long name wraps, the command stays">
        <MiniPlayerDock>
          <ReturnToGame
            leading={<Avatar size={48} initials="AM" />}
            title="Word Tiles with Alexandria-Montgomery"
            turn="Your move"
            caption="Score 0 – 10 · Last move: AERIE h8 10"
            action="Return to your matched game"
            kind="matched"
            onReturn={() => undefined}
          />
        </MiniPlayerDock>
      </ExampleSection>
      <ExampleSection title="Inline: in place of seeking an opponent">
        <ReturnToGame
          placement="inline"
          title="Finish your game session first"
          caption="It is still under way in Robin's space."
          action="Return to the game session"
          kind="custom"
          onReturn={() => undefined}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
