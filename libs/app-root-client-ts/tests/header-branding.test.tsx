/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { AppHeaderIslandView } from '@libs/app-root-client-ts/app-header-island-view';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { screen } from '@solidjs/testing-library';
import { renderChrome } from './render-chrome';

// regression: extracted-header-loses-configured-brand
test('the extracted header shows the exact product spelling and no mark artwork', () => {
  renderChrome(() => (
    <AppHeaderIslandView tabs={[]} pathname="/" onSelect={() => undefined} />
  ));
  const logo = screen.getByRole('img', { name: PRODUCT_NAME });
  expect(logo.textContent).toBe(PRODUCT_NAME);
  expect(logo.querySelector('img')).toBeNull();
});
