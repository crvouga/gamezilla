import { NumberlinkEditor } from '@libs/numberlink-client-ts/numberlink-editor';
import { initialNumberlinkDefinition } from '@libs/numberlink-client-ts/numberlink-editor-actions';
import { NumberlinkPlayer } from '@libs/numberlink-client-ts/numberlink-player';
import { decodeNumberlinkDraft } from '@libs/numberlink-shared-ts/numberlink-definition';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

export function renderNumberlink(ui: () => JSX.Element) {
  const time = createHarnessClock();
  let nextId = 0;
  const view = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <IdProvider createId={() => `new-pair-${++nextId}`} random={() => 0.5}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <SurfaceStackProvider>{ui()}</SurfaceStackProvider>
        </ThemeProvider>
      </IdProvider>
    </ClockProvider>
  ));
  return { ...view, clock: time.clock };
}

export function playerFixture() {
  const definition = initialNumberlinkDefinition();
  const [state, setState] = createSignal('{"paths":[]}');
  const [disabled, setDisabled] = createSignal(false);
  const actions: string[] = [];
  const view = renderNumberlink(() => (
    <NumberlinkPlayer
      definition={definition}
      state={state()}
      disabled={disabled()}
      onAction={(action) => {
        const result = numberlinkPuzzleContent.rules.apply(
          definition,
          state(),
          action
        );
        if (!result.accepted)
          throw new Error('The player emitted an action its rules refuse');
        actions.push(action);
        setState(result.state);
      }}
    />
  ));
  const board = view.getByRole('group', { name: 'Numberlink board' });
  board.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 240,
    bottom: 240,
    width: 240,
    height: 240,
    toJSON: () => ({}),
  });
  board.setPointerCapture = () => {};
  board.releasePointerCapture = () => {};
  const pointer = (type: string, index: number) =>
    fireEvent(
      board,
      new PointerEvent(type, {
        clientX: (index % 3) * 80 + 40,
        clientY: Math.floor(index / 3) * 80 + 40,
        pointerId: 1,
        button: 0,
        isPrimary: true,
        bubbles: true,
        cancelable: true,
      })
    );
  return {
    view,
    board,
    pointer,
    state,
    setState,
    actions,
    setDisabled,
    definition,
  };
}

export function editorFixture() {
  const [definition, setDefinition] = createSignal(
    initialNumberlinkDefinition()
  );
  const changes: string[] = [];
  const view = renderNumberlink(() => (
    <NumberlinkEditor
      definition={definition()}
      disabled={false}
      onChange={(next) => {
        changes.push(next);
        setDefinition(next);
      }}
    />
  ));
  const board = () => {
    const parsed = decodeNumberlinkDraft(definition());
    if (!parsed.valid) throw new Error('Editor emitted an unreadable draft');
    return parsed.value;
  };
  return { view, definition, setDefinition, board, changes };
}
