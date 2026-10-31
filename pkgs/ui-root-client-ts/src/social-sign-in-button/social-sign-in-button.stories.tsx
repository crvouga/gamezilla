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
    await expect(document.fonts.check('500 14px "Google Sans"')).toBe(true);
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
