/** @jsxImportSource solid-js */
/**
 * E2E paint token: an unpainted, zero-size SVG `<text>` naming what its
 * parent node paints, so a UI driver reads a layer's text as the painted
 * board. (`<title>` would be `display: none`, i.e. not user-visible text.)
 * Omitted from production builds (same gate as `data-component`).
 */

import {
  type ChessBoardPaintKind,
  chessBoardPaintToken,
} from '@pkgs/chess-board-core/probe';
import { COMPONENT_IDS_ENABLED } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

export function PaintToken(props: {
  readonly kind: ChessBoardPaintKind;
  readonly at: string;
  readonly detail?: string | undefined;
}): JSX.Element {
  return (
    <Show when={COMPONENT_IDS_ENABLED}>
      <text font-size="0" fill="none" stroke="none">
        {chessBoardPaintToken({
          kind: props.kind,
          at: props.at,
          detail: props.detail,
        })}
      </text>
    </Show>
  );
}
