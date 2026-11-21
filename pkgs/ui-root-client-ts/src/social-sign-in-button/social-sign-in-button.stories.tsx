import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { fonts } from '@pkgs/ui-root-shared-ts/fonts';
import { fontSize } from '@pkgs/ui-root-shared-ts/scale';
import { expect, waitFor } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SocialSignInButton } from './index';
import Example from './social-sign-in-button.example';

const meta = {
  id: 'components-inputs-socialsigninbutton',
  title: 'Molecules/SocialSignInButton',
  component: SocialSignInButton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const face = fonts.google.split(', ')[0] ?? fonts.google;
    await expect(
      document.fonts.check(`500 ${cssPx(fontSize.sm)} ${face}`)
    ).toBe(true);
    const marks = canvasElement.querySelectorAll<HTMLImageElement>(
      '[data-brand="google"] img'
    );
    await expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      await waitFor(() =>
        expect(mark.complete && mark.naturalWidth > 0).toBe(true)
      );
      const wrapper = mark.parentElement;
      if (wrapper === null) throw new Error('Google brand wrapper is missing');
      await expect(getComputedStyle(wrapper).filter).toBe('none');
      await expect(mark.width).toBe(20);
      await expect(mark.height).toBe(20);
    }
  },
};
