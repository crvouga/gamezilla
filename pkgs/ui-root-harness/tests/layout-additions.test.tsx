/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { Image } from '@pkgs/ui-root-client/image';
import { Layer } from '@pkgs/ui-root-client/layer';
import { Spacer } from '@pkgs/ui-root-client/spacer';
import { StackHorizontal } from '@pkgs/ui-root-client/stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

describe('Spacer', () => {
  test('grows when unsized, holds a token step when sized, and is hidden', () => {
    renderUi(() => (
      <StackHorizontal>
        <Spacer testId="grow" />
        <Spacer size="lg" testId="fixed" />
      </StackHorizontal>
    ));
    const grow = screen.getByTestId('grow');
    const fixed = screen.getByTestId('fixed');
    expect(grow.className).toMatch(/\bflex-1\b/);
    expect(fixed.className).toMatch(/\bbasis-ui-lg\b/);
    expect(fixed.className).toMatch(/\bshrink-0\b/);
    expect(grow).toHaveAttribute('aria-hidden', 'true');
    expect(fixed).toHaveAttribute('data-component', 'Spacer');
  });
});

describe('Layer', () => {
  test('covers the parent or the viewport and lays out its children', () => {
    renderUi(() => (
      <>
        <Layer inset="parent" align="center" justify="center" testId="parent">
          {'Badge'}
        </Layer>
        <Layer
          inset="viewport"
          passThrough
          z="raised"
          direction="horizontal"
          testId="viewport"
        >
          {'Over'}
        </Layer>
      </>
    ));
    const parent = screen.getByTestId('parent');
    expect(parent.className).toMatch(/\babsolute inset-0\b/);
    expect(parent.className).toMatch(/\bitems-center\b/);
    expect(parent.className).toMatch(/\bjustify-center\b/);
    expect(parent.className).not.toMatch(/\bboxNone\b/);
    const viewport = screen.getByTestId('viewport');
    expect(viewport.className).toMatch(/\bfixed inset-0\b/);
    expect(viewport.className).toMatch(/\bboxNone\b/);
    expect(viewport.className).toMatch(/\bz-1\b/);
    expect(viewport.className).toMatch(/\bflex-row\b/);
  });
});

describe('Image', () => {
  test('a lazy, framed picture over a muted placeholder until it loads', () => {
    renderUi(() => (
      <Image
        src="/board.png"
        alt="The board after move 32"
        ratio="4:3"
        radius="card"
        size="md"
        testId="pic"
      />
    ));
    const frame = screen.getByTestId('pic');
    const img = screen.getByRole('img', { name: 'The board after move 32' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(frame.className).toMatch(/\baspect-4\/3\b/);
    expect(frame.className).toMatch(/\bbg-surface-muted\b/);
    expect(frame.className).toMatch(/\brounded-card\b/);
    expect(frame).toHaveAttribute('data-state', 'loading');
    expect(img.className).toMatch(/\bopacity-0\b/);
    fireEvent.load(img);
    expect(frame).toHaveAttribute('data-state', 'loaded');
    expect(img.className).toMatch(/\bopacity-100\b/);
  });

  test('a failed load keeps the placeholder and the alt text', () => {
    renderUi(() => (
      <Image
        src="/missing.png"
        alt="Missing"
        ratio="square"
        fit="contain"
        loading="eager"
      />
    ));
    const img = screen.getByRole('img', { name: 'Missing' });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img.className).toMatch(/\bobject-contain\b/);
    fireEvent.error(img);
    expect(mustQuery('[data-component="Image"]')).toHaveAttribute(
      'data-state',
      'error'
    );
    expect(img.className).toMatch(/\bopacity-0\b/);
  });
});
