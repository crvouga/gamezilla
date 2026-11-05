import type { SokobanBoard } from '@libs/sokoban-shared-ts/sokoban-types';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { DisclosureCard } from '@pkgs/ui-root-client-ts/disclosure-card';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { createEffect, createSignal, type JSX } from 'solid-js';

/**
 * The board's size, set once and then out of the way: one closed line
 * ("Board size · 7 × 6") on a phone, so the board is in view under the
 * tools; open beside the board where there is room. Resizing can remove
 * pieces, so a new size applies only when chosen.
 */
export function SokobanSizeControls(props: {
  board: SokobanBoard;
  disabled: boolean;
  onResize: (columns: number, rows: number) => void;
}): JSX.Element {
  const { t } = useLingui();
  const mode = useLayoutMode();
  const [columns, setColumns] = createSignal('');
  const [rows, setRows] = createSignal('');
  createEffect(() => {
    setColumns(String(props.board.width));
    setRows(String(props.board.height));
  });
  const whole = (text: string): number =>
    /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  return (
    <DisclosureCard
      title={t`Board size · ${props.board.width} × ${props.board.height}`}
      defaultOpen={mode() === 'wide'}
      toggleTestId="sokoban-size-toggle"
      dataSet={{ testid: 'sokoban-size' }}
    >
      <StackHorizontal gap="sm" align="end">
        <TextInput
          grow
          label={t`Columns`}
          inputMode="numeric"
          value={columns()}
          maxLength={3}
          disabled={props.disabled}
          onChangeText={setColumns}
          dataSet={{ testid: 'sokoban-columns' }}
        />
        <TextInput
          grow
          label={t`Rows`}
          inputMode="numeric"
          value={rows()}
          maxLength={3}
          disabled={props.disabled}
          onChangeText={setRows}
          dataSet={{ testid: 'sokoban-rows' }}
        />
        <Button
          title={t`Change size`}
          intent="neutral"
          variant="outline"
          disabled={props.disabled}
          onClick={() => props.onResize(whole(columns()), whole(rows()))}
          dataSet={{ testid: 'sokoban-resize' }}
        />
      </StackHorizontal>
    </DisclosureCard>
  );
}
