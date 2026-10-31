/** @jsxImportSource solid-js */
/**
 * Test paint tokens: unpainted text naming what their parent node paints, so
 * a UI driver reads a layer's text as the painted board. `PaintToken` sits
 * in SVG (a zero-size `<text>` — `<title>` would be `display: none`, i.e.
 * not user-visible text); `HtmlPaintToken` sits in an HTML cell. Omitted
 * from production builds (same gate as `data-component`): there the
 * components are a no-op chosen at load, so they cost nothing at all.
 */

import type { ChessBoardPaintKind } from '@pkgs/chess-board-core-shared-ts/probe';
import { chessBoardPaintToken } from '@pkgs/chess-board-core-shared-ts/probe';
import { COMPONENT_IDS_ENABLED } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

import styles from '../chess-board/chess-board.module.css';

type PaintTokenProps = {
  readonly kind: ChessBoardPaintKind;
  readonly at: string;
  readonly detail?: string | undefined;
};

function SvgToken(props: PaintTokenProps): JSX.Element {
  return (
    <text font-size="0" fill="none" stroke="none">
      {chessBoardPaintToken({
        kind: props.kind,
        at: props.at,
        detail: props.detail,
      })}
    </text>
  );
}

function HtmlToken(props: PaintTokenProps): JSX.Element {
  return (
    <span class={styles['token']}>
      {chessBoardPaintToken({
        kind: props.kind,
        at: props.at,
        detail: props.detail,
      })}
    </span>
  );
}

/** Production: renders nothing and creates nothing (not even a `<Show>`). */
function NoToken(_props: PaintTokenProps): JSX.Element {
  return null;
}

export const PaintToken = COMPONENT_IDS_ENABLED ? SvgToken : NoToken;
export const HtmlPaintToken = COMPONENT_IDS_ENABLED ? HtmlToken : NoToken;
