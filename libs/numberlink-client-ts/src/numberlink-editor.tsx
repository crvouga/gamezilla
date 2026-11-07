import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import type { EndpointPair } from '@libs/numberlink-shared-ts/numberlink-types';
import { PAIR_COLORS } from '@libs/numberlink-shared-ts/numberlink-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EditorWorkbench } from '@pkgs/ui-root-client-ts/editor-workbench';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { NumberStepper } from '@pkgs/ui-root-client-ts/number-stepper';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal, type JSX, Show } from 'solid-js';
import { NumberlinkBoard } from './numberlink-board';
import {
  type NumberlinkEditorInputs,
  useNumberlinkEditor,
} from './use-numberlink-editor';

type Editor = ReturnType<typeof useNumberlinkEditor>;

function PairTools(props: {
  editor: Editor;
  pair: EndpointPair;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const names = () => ({
    red: t`Red`,
    orange: t`Orange`,
    yellow: t`Yellow`,
    green: t`Green`,
    blue: t`Blue`,
    purple: t`Purple`,
  });
  return (
    <StackVertical gap="md">
      <TextInput
        label={t`Pair label`}
        value={props.pair.label}
        maxLength={8}
        disabled={props.disabled}
        onChangeText={(label) =>
          props.editor.editPair({ ...props.pair, label })
        }
        dataSet={{ testid: 'numberlink-pair-label' }}
      />
      <Select
        label={t`Pair color`}
        options={PAIR_COLORS.map((color) => ({
          value: color,
          label: names()[color],
        }))}
        value={props.pair.color}
        disabled={props.disabled}
        onValueChange={(color) =>
          props.editor.editPair({ ...props.pair, color })
        }
      />
    </StackVertical>
  );
}

/** Pair and endpoint are chosen at the board; the pair's settings stay in tools. */
function PairPlacement(props: {
  editor: Editor;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="sm" testId="numberlink-placement">
      <Select
        label={t`Pair`}
        value={props.editor.selected()}
        options={(props.editor.board()?.pairs ?? []).map((pair) => ({
          value: pair.id,
          label: pair.label,
        }))}
        disabled={props.disabled}
        onValueChange={props.editor.setSelected}
      />
      <Show when={props.editor.pair()}>
        <P variant="label">
          <Trans>Endpoint to move</Trans>
        </P>
        <SegmentedControl
          aria-label={t`Endpoint to move`}
          dataSet={{ testid: 'numberlink-move' }}
          segments={[
            { key: 'first' as const, label: t`First endpoint` },
            { key: 'second' as const, label: t`Second endpoint` },
          ]}
          selected={props.editor.endpoint() === 0 ? 'first' : 'second'}
          onSelect={(endpoint) =>
            props.editor.setEndpoint(endpoint === 'first' ? 0 : 1)
          }
          disabled={props.disabled}
        />
      </Show>
    </StackVertical>
  );
}

function RemoveEndpoints(props: {
  editor: Editor;
  disabled: boolean;
}): JSX.Element {
  const [operation, setOperation] = createSignal<
    { kind: 'pair'; id: string } | { kind: 'all' } | null
  >(null);
  return (
    <>
      <StackHorizontal gap="sm" wrap>
        <Button
          title={<Trans>Remove pair</Trans>}
          disabled={props.disabled || props.editor.pair() === undefined}
          onClick={() =>
            setOperation({ kind: 'pair', id: props.editor.selected() })
          }
          intent="neutral"
          variant="outline"
        />
        <Button
          title={<Trans>Clear endpoints</Trans>}
          disabled={props.disabled || props.editor.board()?.pairs.length === 0}
          onClick={() => setOperation({ kind: 'all' })}
          intent="neutral"
          variant="outline"
        />
      </StackHorizontal>
      <MutationModal
        visible={operation() !== null}
        onClose={() => setOperation(null)}
        title={
          operation()?.kind === 'pair' ? (
            <Trans>Remove this pair?</Trans>
          ) : (
            <Trans>Clear every endpoint?</Trans>
          )
        }
        message={
          <Trans>
            This changes your working draft. Published editions keep their
            endpoints.
          </Trans>
        }
        submitLabel={<Trans>Remove endpoints</Trans>}
        variant="destructive"
        successTitle={<Trans>Endpoints removed</Trans>}
        operation={() => {
          const pending = operation();
          if (pending?.kind === 'pair') props.editor.remove(pending.id);
          else if (pending?.kind === 'all') props.editor.clear();
          return Promise.resolve();
        }}
      />
    </>
  );
}

/** Shared authoring owns saving, history, validation, playtesting and publication. */
export function NumberlinkEditor(props: PuzzleEditorProps): JSX.Element {
  const createId = useCreateId();
  return <NumberlinkEditorView {...props} createId={createId} />;
}

/**
 * The Numberlink builder's own tools, presentational: board size and
 * coverage, the endpoints on the board, and each pair's label, color and
 * endpoints. New pairs take their id from `createId`.
 */
export function NumberlinkEditorView(
  props: NumberlinkEditorInputs
): JSX.Element {
  const { t } = useLingui();
  const editor = useNumberlinkEditor(props);
  return (
    <Show
      when={editor.board()}
      fallback={
        <Notice tone="error">
          <Trans>
            This drawing cannot be opened. Choose an earlier saved draft to
            continue editing.
          </Trans>
        </Notice>
      }
    >
      {(board) => (
        // Frequent placement choices lead the board. Pair details, size
        // and coverage stay beside it, or follow it on a phone.
        <EditorWorkbench
          narrowOrder="canvas-first"
          canvas={
            <>
              <Show when={board().pairs.length > 0}>
                <PairPlacement editor={editor} disabled={props.disabled} />
              </Show>
              <NumberlinkBoard
                definition={board()}
                state={{ paths: [] }}
                disabled={props.disabled}
                onActivate={editor.place}
              />
              <P variant="caption" tone="secondary">
                <Trans>
                  Choose a pair and which endpoint to move, then choose an empty
                  cell. Every pair has a label as well as a color.
                </Trans>
              </P>
              <Show when={editor.error()}>
                {(error) => <Notice tone="error">{error()}</Notice>}
              </Show>
            </>
          }
          tools={
            <>
              <Show when={editor.pair()}>
                {(pair) => (
                  <PairTools
                    editor={editor}
                    pair={pair()}
                    disabled={props.disabled}
                  />
                )}
              </Show>
              <Button
                title={t`Add pair`}
                disabled={props.disabled}
                onClick={editor.add}
              />
              <RemoveEndpoints editor={editor} disabled={props.disabled} />
              <NumberStepper
                label={t`Columns`}
                dataSet={{ testid: 'numberlink-columns' }}
                value={board().width}
                min={2}
                max={20}
                disabled={props.disabled}
                onChange={(n) => editor.resize('width', n)}
              />
              <NumberStepper
                label={t`Rows`}
                dataSet={{ testid: 'numberlink-rows' }}
                value={board().height}
                min={2}
                max={20}
                disabled={props.disabled}
                onChange={(n) => editor.resize('height', n)}
              />
              <Select
                label={t`Coverage`}
                value={board().coverage}
                disabled={props.disabled}
                options={[
                  { value: 'all' as const, label: t`Cover every cell` },
                  { value: 'pairs' as const, label: t`Connect pairs only` },
                ]}
                onValueChange={(coverage) =>
                  editor.change({ ...board(), coverage }, '')
                }
              />
            </>
          }
        />
      )}
    </Show>
  );
}
