/** @jsxImportSource @solidjs/web */

import { afterEach, describe, expect, test } from 'bun:test';
import {
  EditorStageScreen,
  type EditorStageScreenProps,
} from '@pkgs/ui-root-client-ts/editor-stage-screen';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';
import { mustQuery, renderUi } from './render';

afterEach(cleanup);

function mount(
  overrides: Partial<EditorStageScreenProps> = {},
  size: { width: number; height: number } = { width: 1024, height: 768 }
): { backs: number; details: number } {
  const pressed = { backs: 0, details: 0 };
  renderUi(
    () => (
      <EditorStageScreen
        screenId="level-editor"
        back={{
          label: 'Back to the steps',
          onPress: () => {
            pressed.backs += 1;
          },
          testId: 'editor-back',
        }}
        title="Level 4"
        settings={{
          label: 'Details',
          onPress: () => {
            pressed.details += 1;
          },
          testId: 'editor-details',
        }}
        status="Saved on this device."
        commandsLabel="Editing"
        commands={
          <>
            <button type="button" data-testid="undo">
              Undo
            </button>
            <button type="button" data-testid="redo" disabled>
              Redo
            </button>
          </>
        }
        {...overrides}
      >
        <div data-testid="board">Board</div>
      </EditorStageScreen>
    ),
    size
  );
  return pressed;
}

const order = (selectors: readonly string[]): boolean =>
  selectors.every((selector, index) => {
    const next = selectors[index + 1];
    if (next === undefined) return true;
    return (
      (mustQuery(selector).compareDocumentPosition(mustQuery(next)) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
    );
  });

describe('EditorStageScreen', () => {
  test('the header, the status line, the stage and the commands read top to bottom', () => {
    mount({ notices: <div data-testid="notice">Save failed</div> });
    expect(
      order([
        '[data-component="EditorStageHeader"]',
        '[data-component="EditorStageNotices"]',
        '[data-component="EditorStageStatus"]',
        '[data-component="EditorStageCanvas"]',
        '[data-component="EditorStageCommands"]',
      ])
    ).toBe(true);
    const root = mustQuery('[data-screen="level-editor"]');
    expect(root.getAttribute('data-component')).toBe('EditorStageScreen');
    expect(
      mustQuery('[data-component="EditorStageCanvas"]').contains(
        screen.getByTestId('board')
      )
    ).toBe(true);
    expect(mustQuery('[data-component="EditorStageStatus"]').textContent).toBe(
      'Saved on this device.'
    );
  });

  test('back and settings frame the title as named buttons', () => {
    const pressed = mount();
    const header = mustQuery('[data-component="EditorStageHeader"]');
    expect(header.querySelector('h1')?.textContent).toBe('Level 4');
    const back = screen.getByTestId('editor-back');
    const details = screen.getByTestId('editor-details');
    expect(header.firstElementChild?.contains(back)).toBe(true);
    expect(header.lastElementChild?.contains(details)).toBe(true);
    expect(back.getAttribute('aria-label')).toBe('Back to the steps');
    expect(details.getAttribute('aria-label')).toBe('Details');
    fireEvent.click(back);
    fireEvent.click(details);
    expect(pressed).toEqual({ backs: 1, details: 1 });
  });

  test('without settings the header holds back and the title only', () => {
    mount({ settings: undefined });
    const header = mustQuery('[data-component="EditorStageHeader"]');
    expect(header.children.length).toBe(2);
    expect(screen.queryByTestId('editor-details')).toBeNull();
  });

  test('the commands are one named group under the stage, disabled ones kept', () => {
    mount();
    const commands = screen.getByRole('group', { name: 'Editing' });
    expect(commands.getAttribute('data-component')).toBe('EditorStageCommands');
    expect(commands.contains(screen.getByTestId('undo'))).toBe(true);
    expect(screen.getByTestId('redo').hasAttribute('disabled')).toBe(true);
    expect(commands.contains(screen.getByTestId('redo'))).toBe(true);
  });

  test('empty notices and commands take no room', () => {
    mount({ notices: undefined, commands: undefined });
    expect(
      document.querySelector('[data-component="EditorStageNotices"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-component="EditorStageCommands"]')
    ).toBeNull();
  });

  // The stage never remounts as the status line changes: an editor's
  // in-progress gesture survives a save finishing.
  test('a changing status line keeps the stage mounted', () => {
    const [status, setStatus] = createSignal('Saving…');
    renderUi(() => (
      <EditorStageScreen
        screenId="level-editor"
        back={{ label: 'Back', onPress: () => undefined, testId: 'back' }}
        title="Level 4"
        status={status()}
        commandsLabel="Editing"
      >
        <div data-testid="board">Board</div>
      </EditorStageScreen>
    ));
    const board = screen.getByTestId('board');
    setStatus('Saved on this device.');
    flush();
    expect(mustQuery('[data-component="EditorStageStatus"]').textContent).toBe(
      'Saved on this device.'
    );
    expect(screen.getByTestId('board')).toBe(board);
  });

  test('on a phone nothing is pinned over the stage', () => {
    mount({}, { width: 390, height: 844 });
    expect(
      document.querySelector('[data-component="EmbeddedScreenFooter"]')
    ).toBeNull();
    const commands = mustQuery('[data-component="EditorStageCommands"]');
    expect(commands.parentElement?.getAttribute('data-component')).toBe(
      'EditorStageColumn'
    );
  });
});
