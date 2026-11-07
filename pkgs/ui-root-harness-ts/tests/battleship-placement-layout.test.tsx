import { expect, test } from 'bun:test';
import { BattleshipPlacementLayout } from '@pkgs/ui-root-client-ts/battleship-placement-layout';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

test('the fleet overview cannot steal placement focus from the working grid', () => {
  // regression: battleship-placement-detached-overview
  renderUi(() => (
    <BattleshipPlacementLayout
      overviewLabel="Fleet overview"
      controls={<button type="button">Choose ship</button>}
      region={<button type="button">Placement area</button>}
      feedback={<p role="alert">Overlap. Choose another bow or rotate.</p>}
      working={<button type="button">Place at A1</button>}
      overview={
        <div inert>
          <button type="button">Overview A1</button>
        </div>
      }
    />
  ));
  expect(screen.getByText('Fleet overview')).toBeTruthy();
  expect(screen.getByRole('alert').closest('[inert]')).toBeNull();
  expect(screen.getByText('Overview A1').closest('[inert]')).not.toBeNull();
  expect(screen.getByText('Place at A1').closest('[inert]')).toBeNull();
  expect(screen.getByText('Choose ship').closest('[inert]')).toBeNull();
  const region = screen.getByText('Placement area');
  expect(region.closest('[inert]')).toBeNull();
  expect(
    region.compareDocumentPosition(screen.getByRole('alert')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});
