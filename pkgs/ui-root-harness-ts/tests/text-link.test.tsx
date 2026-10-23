/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

describe('TextLink', () => {
  test('a real link, inline and tinted by default', () => {
    renderUi(() => <TextLink href="/terms">{'terms'}</TextLink>);
    const link = screen.getByRole('link', { name: 'terms' });
    expect(link).toHaveAttribute('href', '/terms');
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('data-variant', 'inline');
    expect(link.className).toMatch(/\btextLink\b/);
  });

  test('external opens a new tab safely and says so', () => {
    renderUi(() => (
      <TextLink href="https://example.com" external variant="standalone">
        {'Guide'}
      </TextLink>
    ));
    const link = screen.getByRole('link', {
      name: 'Guide (opens in a new tab)',
    });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.className).toMatch(/\bmin-h-ui-control-md\b/);
  });

  test('download names the saved file', () => {
    renderUi(() => (
      <TextLink href="data:text/plain,hi" download="hi.txt" tone="secondary">
        {'Download'}
      </TextLink>
    ));
    const link = screen.getByRole('link', { name: 'Download' });
    expect(link).toHaveAttribute('download', 'hi.txt');
    expect(link.className).toMatch(/\btext-text-secondary\b/);
  });

  test('onPress takes a plain click and leaves a modified click to the browser', () => {
    const onPress = mock();
    renderUi(() => (
      <TextLink href="/games" onPress={onPress}>
        {'Games'}
      </TextLink>
    ));
    const link = screen.getByRole('link', { name: 'Games' });
    const plain = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(onPress).toHaveBeenCalledTimes(1);
    const modified = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    link.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.click(link, { ctrlKey: true });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
