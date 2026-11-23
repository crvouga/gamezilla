import { expect, test } from 'bun:test';
import {
  SpaceOffer,
  SpaceOfferProvider,
} from '@libs/spaces-client-ts/space-offer-context';
import { render } from '@solidjs/testing-library';

test('a supplied offer shows at the top of the space', () => {
  const Offer = () => <span data-testid="offer">offer</span>;
  const { container } = render(() => (
    <SpaceOfferProvider offer={Offer}>
      <SpaceOffer />
    </SpaceOfferProvider>
  ));
  expect(container.querySelector('[data-testid="offer"]')).not.toBeNull();
});

test('without one, the space shows nothing there', () => {
  const { container } = render(() => <SpaceOffer />);
  expect(container.innerHTML).toBe('');
});
