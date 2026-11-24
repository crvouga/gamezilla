/** @jsxImportSource @solidjs/web */

import { MiniPlayerDock } from '@pkgs/ui-root-client-ts/mini-player';
import { ReturnToGame } from '@pkgs/ui-root-client-ts/return-to-game';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function ReturnToGameExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Docked: a custom game waits in another space">
        <MiniPlayerDock>
          <ReturnToGame
            title="Your custom game is under way"
            caption="Chess · Robin's space"
            action="Return to the custom game"
            kind="custom"
            onReturn={() => undefined}
          />
        </MiniPlayerDock>
      </ExampleSection>
      <ExampleSection title="Docked: a long name wraps, the command stays">
        <MiniPlayerDock>
          <ReturnToGame
            title="Your matched game against Alexandria-Montgomery waits for your move"
            caption="Connect Four · 3 days per move"
            action="Return to your matched game"
            kind="matched"
            onReturn={() => undefined}
          />
        </MiniPlayerDock>
      </ExampleSection>
      <ExampleSection title="Inline: in place of seeking an opponent">
        <ReturnToGame
          placement="inline"
          title="Finish your custom game first"
          caption="It is still under way in Robin's space."
          action="Return to the custom game"
          kind="custom"
          onReturn={() => undefined}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
